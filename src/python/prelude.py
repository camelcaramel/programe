# programe 파이썬 런타임 (Pyodide, Web Worker 안에서 한 번 실행됨)
# 학생 코드는 제한된 builtins 와 게임 API 만 볼 수 있다.
import builtins as _b
import json
import sys
import time
import traceback

SKILLS = ("fireball", "icebolt", "heal")
MAX_CASTS = 3
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


class _Timeout(BaseException):
    """학생 코드의 except Exception 으로는 잡히지 않는다."""


class Enemy:
    def __init__(self, d):
        self.hp = d["hp"]
        self.max_hp = d["max_hp"]
        self.type = d["type"]
        self.distance = d["distance"]
        self.exists = d["exists"]

    def __repr__(self):
        return f"Enemy(type={self.type!r}, hp={self.hp}, max_hp={self.max_hp}, distance={self.distance})"


def _friendly(e):
    name = type(e).__name__
    msg = str(e)
    if isinstance(e, ImportError):
        return "import 는 사용할 수 없어요. 게임 API(cast, get_enemy_hp ...)만 쓸 수 있어요."
    if isinstance(e, NameError):
        return f"이름을 찾을 수 없어요: {msg}  → 철자나 따옴표를 확인해 보세요."
    if isinstance(e, ZeroDivisionError):
        return "0 으로 나눌 수 없어요."
    if isinstance(e, AttributeError):
        return f"없는 속성이에요: {msg}  → enemy 는 hp, max_hp, type, distance 를 가지고 있어요."
    if isinstance(e, TypeError):
        return f"값의 종류가 맞지 않아요: {msg}"
    if isinstance(e, (ValueError, RuntimeError)):
        return msg
    return f"{name}: {msg}"


def _line_of(e):
    for fr in reversed(traceback.extract_tb(e.__traceback__)):
        if fr.filename == FILENAME:
            return fr.lineno
    return None


def _run(payload_json):
    p = json.loads(payload_json)
    casts = []
    out = []
    player = p["player"]
    enemy = Enemy(p["enemy"])

    def cast(name):
        if not isinstance(name, str) or name not in SKILLS:
            raise ValueError(f"알 수 없는 스킬이에요: {name!r}  (사용 가능: fireball, icebolt, heal)")
        if len(casts) >= MAX_CASTS:
            raise RuntimeError(f"한 번 실행에 cast 는 최대 {MAX_CASTS}번까지만 할 수 있어요.")
        casts.append(name)

    def _print(*args, sep=" ", end="\n"):
        if len(out) < 30:
            out.append(sep.join(str(a) for a in args))

    def get_enemy_hp():
        return enemy.hp

    def get_player_hp():
        return player["hp"]

    def get_player_mp():
        return player["mp"]

    safe = dict(_SAFE)
    safe["print"] = _print
    g = {
        "__builtins__": safe,
        "__name__": "__student__",
        "cast": cast,
        "get_enemy_hp": get_enemy_hp,
        "get_player_hp": get_player_hp,
        "get_player_mp": get_player_mp,
    }

    limit = p.get("step_limit", 20000)
    deadline = time.perf_counter() + p.get("time_limit", 0.5)
    steps = [0]

    def tracer(frame, event, arg):
        steps[0] += 1
        if steps[0] > limit or time.perf_counter() > deadline:
            raise _Timeout()
        return tracer

    def fail(message, line=None, kind="error"):
        return json.dumps({"ok": False, "error": message, "line": line, "kind": kind, "casts": casts, "out": out})

    try:
        code = compile(p["code"], FILENAME, "exec")
    except SyntaxError as e:
        hint = "들여쓰기나 콜론(:), 괄호를 확인해 보세요."
        if isinstance(e, IndentationError):
            hint = "들여쓰기(스페이스 4칸)를 확인해 보세요."
        return fail(f"문법 오류: {e.msg}  → {hint}", e.lineno, "syntax")

    sys.settrace(tracer)
    try:
        exec(code, g)
        fn = g.get("attack_strategy")
        if not callable(fn):
            sys.settrace(None)
            return fail("attack_strategy(enemy) 함수를 찾을 수 없어요. def attack_strategy(enemy): 로 시작해 주세요.", None, "missing")
        fn(enemy)
    except _Timeout:
        sys.settrace(None)
        return fail("코드가 너무 오래 실행돼요. 끝나지 않는 반복문(while)이 있는지 확인해 보세요.", None, "timeout")
    except Exception as e:  # noqa: BLE001
        sys.settrace(None)
        return fail(_friendly(e), _line_of(e), "runtime")
    finally:
        sys.settrace(None)
    return json.dumps({"ok": True, "casts": casts, "out": out, "steps": steps[0]})
