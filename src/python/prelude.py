# programe 파이썬 런타임 (Pyodide, Web Worker 안에서 한 번 실행됨)
# 학생 코드는 제한된 builtins 와 게임 명령만 볼 수 있다.
#
# 학생 코드는 함수 정의 없이 위에서부터 실행되는 스크립트다.
# 실제 규칙은 JS 시뮬레이터(src/sim)에 있고, 여기서는 api 객체(src/python/stageBridge.ts)를 부르기만 한다.
# api 함수는 예외를 던지지 않고 문자열로 알려 준다: "STOP:<이유>" = 게임 끝, "ERR:<메시지>" = 잘못된 입력.
import ast as _ast
import builtins as _b
import json
import sys
import time
import traceback

FILENAME = "<내 코드>"

_SAFE_NAMES = [
    "abs", "all", "any", "bool", "dict", "divmod", "enumerate", "filter", "float",
    "int", "isinstance", "len", "list", "map", "max", "min", "pow", "range",
    "reversed", "round", "set", "sorted", "str", "sum", "tuple", "zip",
    "Exception", "ValueError", "TypeError", "KeyError", "IndexError",
    "ZeroDivisionError", "RuntimeError", "NameError", "AttributeError",
    "__build_class__", "object", "True", "False", "None",
]
_SAFE = {n: getattr(_b, n) for n in _SAFE_NAMES if hasattr(_b, n)}

DIR_NAMES = ("up", "down", "left", "right")
STAGE_API_NAMES = (
    "move_up", "move_down", "move_left", "move_right",
    "look", "cast", "get_hp", "get_pos", "get_coins", "get_keys", "print",
)


class _Timeout(BaseException):
    """시간 초과. 학생 코드의 except 로는 잡히지 않는다."""


class _Stop(BaseException):
    """게임이 끝남(클리어·사망·턴 제한). 학생 코드의 except 로는 잡히지 않는다."""


class _BareExceptFix(_ast.NodeTransformer):
    """학생 코드의 `except:` 를 `except Exception:` 으로 바꾼다.
    그래야 게임 종료(_Stop)와 시간 초과(_Timeout)를 학생 코드가 삼키지 못한다."""

    def visit_ExceptHandler(self, node):
        self.generic_visit(node)
        if node.type is None:
            node.type = _ast.copy_location(_ast.Name(id="Exception", ctx=_ast.Load()), node)
        return node


def _compile_student(code_str):
    tree = _ast.parse(code_str, FILENAME, "exec")
    tree = _ast.fix_missing_locations(_BareExceptFix().visit(tree))
    return compile(tree, FILENAME, "exec")


def _friendly(e):
    msg = str(e)
    if isinstance(e, ImportError):
        return "import 는 사용할 수 없어요. 게임 명령(move_right, look, cast ...)만 쓸 수 있어요."
    if isinstance(e, NameError):
        return f"이름을 찾을 수 없어요: {msg}  → 철자나 따옴표를 확인해 보세요."
    if isinstance(e, ZeroDivisionError):
        return "0 으로 나눌 수 없어요."
    if isinstance(e, AttributeError):
        return f"없는 속성이에요: {msg}"
    if isinstance(e, TypeError) and "positional argument" in msg:
        return f"괄호 안에 넣는 값의 개수가 맞지 않아요: {msg}"
    if isinstance(e, TypeError):
        return f"값의 종류가 맞지 않아요: {msg}"
    if isinstance(e, (ValueError, RuntimeError)):
        return msg
    return f"{type(e).__name__}: {msg}"


_SYNTAX_KO = [
    # (영어 메시지에 들어 있는 말, 한국어 설명)  — 위에서부터 먼저 맞는 것을 쓴다
    ("expected an indented block", "{kw}다음 줄은 안쪽으로 들여 써야 해요 (스페이스 4칸)."),
    ("unexpected indent", "이 줄은 들여 쓸 필요가 없어요. 앞의 빈칸을 지워 보세요."),
    ("unindent does not match", "들여쓰기 칸 수가 위 줄들과 맞지 않아요. 스페이스 4칸 단위로 맞춰 보세요."),
    ("expected ':'", "줄 끝에 콜론(:)이 빠졌어요."),
    ("was never closed", "여는 괄호가 닫히지 않았어요."),
    ("unmatched", "닫는 괄호가 하나 더 있어요."),
    ("unterminated string", "따옴표(\")가 닫히지 않았어요."),
    ("invalid character", "파이썬에서 쓸 수 없는 글자가 있어요. 한글 따옴표나 특수 문자를 확인해 보세요."),
    ("Perhaps you forgot a comma", "쉼표(,)가 빠진 것 같아요."),
    ("Maybe you meant '==' or ':='", "비교할 때는 = 가 아니라 == 를 써요."),
    ("cannot assign to", "= 왼쪽에는 변수 이름만 올 수 있어요. 비교라면 == 를 써요."),
    ("invalid syntax", "파이썬 문법에 맞지 않아요. 철자, 괄호, 콜론(:)을 확인해 보세요."),
]


def _syntax_ko(e):
    msg = e.msg or ""
    kw = ""
    if "after '" in msg:
        kw = msg.split("after '", 1)[1].split("'", 1)[0] + " 문 "
    for key, ko in _SYNTAX_KO:
        if key in msg:
            return ko.format(kw=kw)
    return msg


def _line_of(e):
    for fr in reversed(traceback.extract_tb(e.__traceback__)):
        if fr.filename == FILENAME:
            return fr.lineno
    return None


def _student_line():
    f = sys._getframe(1)
    while f is not None:
        if f.f_code.co_filename == FILENAME:
            return f.f_lineno
        f = f.f_back
    return None


def _check(res):
    if isinstance(res, str):
        if res.startswith("STOP:"):
            raise _Stop(res[5:])
        if res.startswith("ERR:"):
            raise ValueError(res[4:])
    return res


def _run_stage(code_str, api, limits_json):
    """시드 하나를 실행한다. 게임 상태는 api 쪽 World 에 남고, 여기서는 오류·출력만 돌려준다."""
    limits = json.loads(limits_json)
    out = []

    def _print(*args, sep=" ", end="\n"):
        if len(out) < 50:
            out.append(sep.join(str(a) for a in args))

    def move_up():
        _check(api.move("up", _student_line()))

    def move_down():
        _check(api.move("down", _student_line()))

    def move_left():
        _check(api.move("left", _student_line()))

    def move_right():
        _check(api.move("right", _student_line()))

    def look(direction):
        return _check(api.look(direction, _student_line()))

    def cast(skill, direction):
        _check(api.cast(skill, direction, _student_line()))

    def get_hp():
        return int(api.hp())

    def get_pos():
        return (int(api.x()), int(api.y()))

    def get_coins():
        return int(api.coins())

    def get_keys():
        return int(api.keys())

    everything = {
        "move_up": move_up, "move_down": move_down, "move_left": move_left, "move_right": move_right,
        "look": look, "cast": cast, "get_hp": get_hp, "get_pos": get_pos,
        "get_coins": get_coins, "get_keys": get_keys, "print": _print,
    }
    allowed = limits.get("api") or list(STAGE_API_NAMES)
    safe = dict(_SAFE)
    safe["print"] = _print
    g = {"__builtins__": safe, "__name__": "__student__"}
    for name in allowed:
        if name in everything:
            g[name] = everything[name]

    step_limit = limits.get("step_limit", 100000)
    deadline = time.perf_counter() + limits.get("time_limit", 0.5)
    steps = [0]

    def tracer(frame, event, arg):
        steps[0] += 1
        if steps[0] > step_limit or time.perf_counter() > deadline:
            raise _Timeout()
        return tracer

    def result(ok, message=None, line=None, kind=None, stop=None):
        return json.dumps({"ok": ok, "error": message, "line": line, "kind": kind, "stop": stop, "out": out, "steps": steps[0]})

    try:
        code = _compile_student(code_str)
    except SyntaxError as e:
        return result(False, "문법 오류: " + _syntax_ko(e), e.lineno, "syntax")

    sys.settrace(tracer)
    try:
        exec(code, g)
    except _Stop as s:
        sys.settrace(None)
        return result(True, stop=str(s))
    except _Timeout:
        sys.settrace(None)
        return result(False, "코드가 너무 오래 실행돼요. 끝나지 않는 반복문(while)이 있는지 확인해 보세요.", None, "timeout")
    except NameError as e:
        sys.settrace(None)
        name = getattr(e, "name", None)
        if name in STAGE_API_NAMES and name not in allowed:
            return result(False, f"{name} 은(는) 아직 배우지 않은 명령이에요. 이 스테이지에서는 쓸 수 없어요.", _line_of(e), "runtime")
        return result(False, _friendly(e), _line_of(e), "runtime")
    except Exception as e:  # noqa: BLE001
        sys.settrace(None)
        return result(False, _friendly(e), _line_of(e), "runtime")
    finally:
        sys.settrace(None)
    return result(True)
