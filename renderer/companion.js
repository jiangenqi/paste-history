// PasteHistory - 伴生窗口（zZ 睡眠指示）交互逻辑
const zzStage = document.getElementById('zzStage');

window.clipboardAPI.onEyeState((state) => {
  if (state === 'asleep') {
    zzStage.classList.add('active');
  } else {
    // 惊醒 / 唤醒：立即隐藏 zZ
    zzStage.classList.remove('active');
  }
});

window.clipboardAPI.onCompanionReset(() => {
  zzStage.classList.remove('active');
});

// zZ 字号跟随眼睛尺寸（small / medium / large）
window.clipboardAPI.onCompanionSize((size) => {
  document.body.classList.remove('size-small', 'size-large');
  if (size === 'small' || size === 'large') {
    document.body.classList.add('size-' + size);
  }
});
