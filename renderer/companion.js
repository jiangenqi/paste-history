// PasteHistory - 伴生窗口（zZ 睡眠指示）交互逻辑
const zzStage = document.getElementById('zzStage');

window.clipboardAPI.onEyeState((state) => {
  if (state === 'asleep') {
    zzStage.classList.add('active');
  } else {
    zzStage.classList.remove('active');
  }
});

window.clipboardAPI.onCompanionReset(() => {
  zzStage.classList.remove('active');
});
