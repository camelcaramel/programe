import { createRoot } from 'react-dom/client';
import App from './ui/App';
import '@fontsource/jua';
// 본문: 굵기가 여러 단계인 Pretendard (쓰는 글자 묶음만 내려받는 분할 웹폰트)
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
// 코드: 한글이 들어 있는 고정폭 글꼴
import '@fontsource/nanum-gothic-coding/400.css';
import '@fontsource/nanum-gothic-coding/700.css';
import './ui/style.css';

createRoot(document.getElementById('root')!).render(<App />);
