# 音效说明

本项目使用 **Web Audio API** 在浏览器中动态生成复古音效（beep、打字声），
无需外部音频文件。详见 `js/y2k-effects.js` 中的 `playBeep()` 函数。

如需添加自定义音效，可将 `.wav` 文件放在此目录，并在代码中通过
`<audio>` 标签引用。
