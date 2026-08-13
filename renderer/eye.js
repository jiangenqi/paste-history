// PasteHistory - 眼睛模式交互逻辑
const leftIris  = document.getElementById('leftIris');
const rightIris = document.getElementById('rightIris');
const leftEye   = document.getElementById('leftEye');
const rightEye  = document.getElementById('rightEye');

// 打开后的冷却时间：这段时间内的点击不会触发"单击关闭"，
// 防止眼睛刚出现（屏幕中央）时用户的误点立即把它关掉
const COOLDOWN_MS = 2000;

let maxShift = 5;
let closing  = false;
let cooldownUntil = Date.now() + COOLDOWN_MS;
let eyeState = 'awake';
let startledTimer = null;

// 窗口重新显示时重置冷却：
// 1) visibilitychange 兜底（某些场景下 Electron 不触发该事件）
// 2) 主进程 IPC 确定性下发（eye:resetCooldown），保证每次呼出都重置
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    cooldownUntil = Date.now() + COOLDOWN_MS;
    closing = false;
  }
});
window.clipboardAPI.onEyeResetCooldown(() => {
  cooldownUntil = Date.now() + COOLDOWN_MS;
  closing = false;
  document.body.classList.remove('closing');
});

function syncMaxShift() {
  const style = getComputedStyle(document.body);
  maxShift = parseFloat(style.getPropertyValue('--max-shift').trim()) || 5;
}

function applyStateClasses(state) {
  document.body.classList.remove('state-drowsy', 'state-asleep', 'state-startled');
  if (state !== 'awake') document.body.classList.add('state-' + state);
}

function playStartled() {
  if (startledTimer) clearTimeout(startledTimer);
  eyeState = 'startled';
  applyStateClasses('startled');
  startledTimer = setTimeout(() => {
    eyeState = 'awake';
    applyStateClasses('awake');
    startledTimer = null;
  }, 950);
}

// ── 主进程推送状态 ──
window.clipboardAPI.onEyeState((state) => {
  if (eyeState === 'startled' && state === 'awake') return;
  if (state === 'awake' && (eyeState === 'drowsy' || eyeState === 'asleep')) {
    playStartled();
    return;
  }
  if (state === eyeState) return;
  eyeState = state;
  applyStateClasses(state);
});

window.resetCooldown = function() {
  cooldownUntil = Date.now() + COOLDOWN_MS;
  closing = false;
  document.body.classList.remove('closing');
  syncMaxShift();
  eyeState = 'awake';
  applyStateClasses('awake');
  if (startledTimer) { clearTimeout(startledTimer); startledTimer = null; }
};

// ── 拖拽 / 点击 ──
let dragging = false, startX = 0, startY = 0, hasMoved = false;

document.body.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return; // 仅左键参与拖拽/单击关闭
  if (closing || Date.now() < cooldownUntil) return;
  dragging = true; hasMoved = false;
  startX = e.screenX; startY = e.screenY;
});

document.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  const dx = e.screenX - startX, dy = e.screenY - startY;
  if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
    hasMoved = true;
    startX = e.screenX; startY = e.screenY;
    window.clipboardAPI.moveEye(dx, dy);
  }
});

document.addEventListener('mouseup', (e) => {
  if (e.button !== 0) return; // 仅左键触发"单击关闭"
  if (!dragging || closing || Date.now() < cooldownUntil) { dragging = false; return; }
  if (!hasMoved) {
    closing = true;
    document.body.classList.add('closing');
    setTimeout(() => { window.clipboardAPI.eyeClicked(); }, 230);
  }
  dragging = false;
});

// ── 瞳孔跟踪 ──
function getEyeCenters() {
  const lr = leftEye.getBoundingClientRect();
  const rr = rightEye.getBoundingClientRect();
  return {
    lx: lr.left + lr.width / 2, ly: lr.top  + lr.height / 2,
    rx: rr.left + rr.width / 2, ry: rr.top  + rr.height / 2
  };
}

function trackPupils() {
  if (closing) return;
  if (eyeState === 'asleep' || eyeState === 'startled') {
    if (eyeState === 'asleep') {
      leftIris.style.transform = rightIris.style.transform = 'translate(0px, 0px)';
    }
    return;
  }
  window.clipboardAPI.getCursorPos().then(pt => {
    if (!pt) return;
    if (!maxShift) syncMaxShift();
    if (eyeState === 'asleep' || eyeState === 'startled') return;
    const ec = getEyeCenters();
    const ldx = pt.cursorX - (pt.winX + ec.lx);
    const ldy = pt.cursorY - (pt.winY + ec.ly);
    const rdx = pt.cursorX - (pt.winX + ec.rx);
    const rdy = pt.cursorY - (pt.winY + ec.ry);
    const pupil = (dx, dy) => {
      const dist = Math.sqrt(dx*dx + dy*dy) || 1;
      const f = Math.min(dist / 500, 1);
      return { x: (dx/dist)*maxShift*f, y: (dy/dist)*maxShift*f };
    };
    const lo = pupil(ldx, ldy), ro = pupil(rdx, rdy);
    leftIris.style.transform  = `translate(${lo.x}px, ${lo.y}px)`;
    rightIris.style.transform = `translate(${ro.x}px, ${ro.y}px)`;
  }).catch(() => {});
}

setInterval(trackPupils, 50);
trackPupils();
