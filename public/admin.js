const metricGrid = document.getElementById('metricGrid');
const healthTable = document.getElementById('healthTable');
const adminStatus = document.getElementById('adminStatus');
const featureSelect = document.getElementById('featureSelect');
const featureDetail = document.getElementById('featureDetail');
const sourceStats = document.getElementById('sourceStats');
const snapshotTable = document.getElementById('snapshotTable');
const refreshButton = document.getElementById('refreshButton');
const clearButton = document.getElementById('clearButton');
const adminLogin = document.getElementById('adminLogin');
const adminDashboard = document.getElementById('adminDashboard');
const adminLoginForm = document.getElementById('adminLoginForm');
const adminPassword = document.getElementById('adminPassword');
const loginButton = document.getElementById('loginButton');
const loginStatus = document.getElementById('loginStatus');

let currentSummary = null;

const PM_DIMENSION_LABELS = {
  businessUnderstanding: '业务理解',
  productDesign: '产品设计',
  architectureDesign: '规则边界',
  userExperience: '用户体验',
  aiKnowledge: 'AI 理解',
};

refreshButton.addEventListener('click', loadSummary);
clearButton.addEventListener('click', clearData);
featureSelect.addEventListener('change', () => renderFeatureDetail(featureSelect.value));
adminLoginForm.addEventListener('submit', handleLogin);

initAdmin();

async function initAdmin() {
  try {
    const status = await fetchJson('/api/admin/status');
    if (status.authenticated) {
      showDashboard();
      await loadSummary();
      return;
    }
    showLogin('请输入后台密码后查看数据。');
  } catch {
    showLogin('请输入后台密码后查看数据。');
  }
}

async function handleLogin(event) {
  event.preventDefault();
  loginButton.disabled = true;
  loginStatus.textContent = '正在进入...';
  try {
    await fetchJson('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: adminPassword.value }),
    });
    adminPassword.value = '';
    showDashboard();
    await loadSummary();
  } catch (error) {
    showLogin(error.message || '密码不正确');
    adminPassword.focus();
  } finally {
    loginButton.disabled = false;
  }
}

function showDashboard() {
  adminLogin.hidden = true;
  adminDashboard.hidden = false;
  loginStatus.textContent = '已登录';
}

function showLogin(message) {
  adminLogin.hidden = false;
  adminDashboard.hidden = true;
  loginStatus.textContent = message;
}

async function loadSummary() {
  try {
    adminStatus.textContent = '正在加载...';
    currentSummary = await fetchJson('/api/summary');
    renderSummary(currentSummary);
    adminStatus.textContent = `最近刷新：${new Date().toLocaleTimeString()}`;
  } catch (error) {
    if (String(error.message).includes('请先输入后台密码')) {
      showLogin('登录已失效，请重新输入后台密码。');
      return;
    }
    adminStatus.textContent = `加载失败：${error.message}`;
    renderEmpty();
  }
}

async function clearData() {
  const confirmed = window.confirm('确认清空当前所有提交数据？这个动作不能撤销。');
  if (!confirmed) return;
  await fetchJson('/api/responses', { method: 'DELETE' });
  await loadSummary();
}

function renderSummary(summary) {
  const sorted = [...summary.features].sort((left, right) => {
    if (left.responseCount === 0 && right.responseCount > 0) return 1;
    if (right.responseCount === 0 && left.responseCount > 0) return -1;
    return (left.qualityAverage ?? 9) - (right.qualityAverage ?? 9);
  });
  const weakest = sorted.find((item) => item.responseCount > 0);
  const signal = summary.pmSignals;

  metricGrid.innerHTML = [
    metric('提交数', summary.totalResponses, '当前已收集的有效反馈'),
    metric('独立 IP', summary.submissionStats?.uniqueIpCount || 0, '辅助判断样本来源'),
    metric('业务理解', formatScore(signal.businessUnderstanding.score), signal.businessUnderstanding.source),
    metric('优先复盘', weakest?.name || '暂无', '综合分越低越需要复盘'),
  ].join('');

  renderSourceStats(summary);
  renderSnapshotTable(summary.submissions || []);

  healthTable.innerHTML = sorted.length
    ? sorted.map(renderFeatureRow).join('')
    : `<tr><td colspan="9"><span class="empty">暂无提交数据。</span></td></tr>`;

  healthTable.querySelectorAll('[data-feature]').forEach((button) => {
    button.addEventListener('click', () => {
      featureSelect.value = button.dataset.feature;
      renderFeatureDetail(button.dataset.feature);
    });
  });

  featureSelect.innerHTML = sorted
    .map((feature) => `<option value="${escapeAttr(feature.name)}">${escapeHtml(feature.name)}</option>`)
    .join('');
  renderFeatureDetail(sorted[0]?.name || '');
}

function renderFeatureRow(feature) {
  return `
    <tr>
      <td>
        <button class="button small" type="button" data-feature="${escapeAttr(feature.name)}">${escapeHtml(feature.name)}</button>
        <span class="tiny">${escapeHtml(feature.group)}</span>
      </td>
      <td>${formatScore(feature.qualityAverage)}</td>
      <td>${feature.responseCount}</td>
      <td>${formatScore(feature.businessFitAverage)}</td>
      <td>${formatScore(feature.completenessAverage)}</td>
      <td>${formatScore(feature.rigorAverage)}</td>
      <td>${formatScore(feature.usabilityAverage)}</td>
      <td>${formatScore(feature.aiDepthAverage)}</td>
      <td>${renderMiniList(feature.topProblems.slice(0, 3))}</td>
    </tr>
  `;
}

function renderSourceStats(summary) {
  const stats = summary.submissionStats || {};
  sourceStats.innerHTML = [
    smallPanel('IP 分布', renderMiniList(stats.topIps || [])),
    smallPanel('设备分布', renderMiniList(stats.deviceCounts || [])),
    smallPanel('浏览器分布', renderMiniList(stats.browserCounts || [])),
  ].join('');
}

function renderSnapshotTable(submissions) {
  snapshotTable.innerHTML = submissions.length
    ? submissions.map(renderSnapshotRow).join('')
    : `<tr><td colspan="6"><span class="empty">暂无提交快照。</span></td></tr>`;
}

function renderSnapshotRow(submission) {
  return `
    <tr>
      <td>${escapeHtml(formatDateTime(submission.createdAt))}</td>
      <td>${escapeHtml(submission.role || '-')}</td>
      <td>${escapeHtml(submission.ip || '-')}</td>
      <td>
        ${escapeHtml(submission.device || '-')}
        <span class="tiny">${escapeHtml(submission.browser || '')}</span>
      </td>
      <td>${renderTextList(submission.features || [])}</td>
      <td>
        <details class="snapshot-detail">
          <summary>查看快照</summary>
          <pre>${escapeHtml(JSON.stringify(submission.snapshot || {}, null, 2))}</pre>
          <p class="tiny">${escapeHtml(submission.userAgent || '')}</p>
        </details>
      </td>
    </tr>
  `;
}

function renderFeatureDetail(featureName) {
  if (!currentSummary || !featureName) {
    featureDetail.innerHTML = `<span class="empty">暂无明细。</span>`;
    return;
  }
  const feature = currentSummary.features.find((item) => item.name === featureName);
  if (!feature) return;

  featureDetail.innerHTML = `
    <div class="stack">
      <div class="grid-3">
        ${smallMetric('综合分', formatScore(feature.qualityAverage))}
        ${smallMetric('样本数', feature.responseCount)}
        ${smallMetric('业务理解', formatScore(feature.businessFitAverage))}
        ${smallMetric('完整性', formatScore(feature.completenessAverage))}
        ${smallMetric('严谨性', formatScore(feature.rigorAverage))}
        ${smallMetric('体验', formatScore(feature.usabilityAverage))}
      </div>
      <div class="repeat-item">
        <h3>功能说明</h3>
        <p>${escapeHtml(feature.description)}</p>
      </div>
      <div class="repeat-item">
        <h3>专属问题得分</h3>
        ${renderQuestionSummaries(feature.questionSummaries)}
      </div>
      <div class="repeat-item">
        <h3>喜欢点分布</h3>
        ${renderMiniList((feature.topLikedPoints || []).slice(0, 6))}
      </div>
      <div class="repeat-item">
        <h3>最大问题场景补充</h3>
        ${feature.problemComments?.length ? renderTextList(feature.problemComments.slice(0, 8)) : '<span class="empty">暂无</span>'}
      </div>
      <div class="repeat-item">
        <h3>喜欢场景补充</h3>
        ${feature.likedComments.length ? renderTextList(feature.likedComments.slice(0, 8)) : '<span class="empty">暂无</span>'}
      </div>
      <div class="repeat-item">
        <h3>不喜欢点分布</h3>
        ${renderMiniList((feature.topDislikedPoints || []).slice(0, 6))}
      </div>
      <div class="repeat-item">
        <h3>不喜欢场景补充</h3>
        ${feature.dislikedComments.length ? renderTextList(feature.dislikedComments.slice(0, 8)) : '<span class="empty">暂无</span>'}
      </div>
    </div>
    <div class="stack">
      <div class="repeat-item">
        <h3>主要问题</h3>
        ${renderMiniList(feature.topProblems.slice(0, 6))}
      </div>
      <div class="repeat-item">
        <h3>接触情况</h3>
        ${renderMiniList(feature.usageCounts)}
      </div>
      <div class="repeat-item">
        <h3>PM 能力侧面信号</h3>
        ${renderPmSignals(currentSummary.pmSignals)}
      </div>
    </div>
  `;
}

function renderPmSignals(signals) {
  return `
    <ul class="mini-list">
      ${Object.values(signals)
        .map((signal) => `<li>${escapeHtml(signal.label)}：${formatScore(signal.score)} <span class="empty">${escapeHtml(signal.source)}</span></li>`)
        .join('')}
    </ul>
  `;
}

function renderQuestionSummaries(items) {
  if (!items || !items.length) return '<span class="empty">暂无</span>';
  return `
    <ul class="mini-list">
      ${items
        .map(
          (item) =>
            `<li>${escapeHtml(item.text)}：${formatScore(item.average)} <span class="empty">${escapeHtml(PM_DIMENSION_LABELS[item.dimension] || item.dimension)}</span></li>`,
        )
        .join('')}
    </ul>
  `;
}

function renderEmpty() {
  metricGrid.innerHTML = [
    metric('提交数', '-', '等待数据'),
    metric('独立 IP', '-', '等待数据'),
    metric('业务理解', '-', '等待数据'),
    metric('优先复盘', '-', '等待数据'),
  ].join('');
  healthTable.innerHTML = `<tr><td colspan="9"><span class="empty">暂无数据。</span></td></tr>`;
  featureDetail.innerHTML = `<span class="empty">暂无明细。</span>`;
  sourceStats.innerHTML = '';
  snapshotTable.innerHTML = `<tr><td colspan="6"><span class="empty">暂无提交快照。</span></td></tr>`;
}

function metric(label, value, note) {
  return `
    <article class="metric">
      <div class="metric-label">${escapeHtml(label)}</div>
      <div class="metric-value">${escapeHtml(String(value))}</div>
      <div class="metric-note">${escapeHtml(note)}</div>
    </article>
  `;
}

function smallMetric(label, value) {
  return `
    <div class="repeat-item">
      <span class="metric-label">${escapeHtml(label)}</span>
      <strong style="font-size: 24px;">${escapeHtml(String(value))}</strong>
    </div>
  `;
}

function smallPanel(label, html) {
  return `
    <div class="repeat-item">
      <h3>${escapeHtml(label)}</h3>
      ${html}
    </div>
  `;
}

function renderMiniList(items) {
  if (!items || !items.length) return '<span class="empty">暂无</span>';
  return `
    <ul class="mini-list">
      ${items.map((item) => `<li>${escapeHtml(item.label)} <span class="empty">(${item.count})</span></li>`).join('')}
    </ul>
  `;
}

function renderTextList(items) {
  return `
    <ul class="mini-list">
      ${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
    </ul>
  `;
}

function formatScore(value) {
  return value === null || value === undefined ? '-' : Number(value).toFixed(1);
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) {
    const message = data.errors ? data.errors.join('；') : response.statusText;
    throw new Error(message);
  }
  return data;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttr(value) {
  return escapeHtml(value);
}
