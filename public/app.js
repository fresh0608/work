const state = {
  config: null,
  evaluations: new Map(),
  activeFeature: '',
  activeSteps: new Map(),
  evaluationStarted: false,
};

const WORKSPACE_STEPS = [
  {
    id: 'score',
    label: '任务判断',
    title: '先判断它能不能帮你完成运营任务',
    hint: '不用打分，直接选择最接近你实际感受的判断。',
  },
  {
    id: 'problem',
    label: '最大问题',
    title: '先选最影响使用的一类问题',
    hint: '选完后请补充一个具体场景，方便判断问题来自业务理解、规则边界还是体验设计。',
  },
  {
    id: 'liked',
    label: '喜欢的点',
    title: '哪里值得保留',
    hint: '快捷选项和自定义合计最多 3 个；选完后请说清楚为什么有价值。',
  },
  {
    id: 'disliked',
    label: '想改的点',
    title: '哪里最影响使用',
    hint: '写清楚哪一步让你犹豫、容易选错，或你希望怎么改。',
  },
];

const form = document.getElementById('surveyForm');
const successView = document.getElementById('successView');
const errorBox = document.getElementById('errors');
const formStatus = document.getElementById('formStatus');
const submitButton = document.getElementById('submitButton');
const overallSection = document.getElementById('overallSection');
const submitArea = document.getElementById('submitArea');

const RESPONSE_SCALE = [
  { value: 1, label: '完全不能', short: '不能' },
  { value: 2, label: '不太能', short: '较弱' },
  { value: 3, label: '说不准', short: '一般' },
  { value: 4, label: '基本能', short: '较好' },
  { value: 5, label: '完全能', short: '很好' },
];

init();

async function init() {
  try {
    state.config = await fetchJson('/api/config');
    renderFeatureGroups();
    bindEvents();
    syncFeatureCards();
    updateSelectedCount();
    renderEvaluationWorkspace();
  } catch (error) {
    showErrors([`页面初始化失败：${error.message}`]);
  }
}

function renderFeatureGroups() {
  const groups = groupBy(state.config.features, 'group');
  document.getElementById('featureGroups').innerHTML = `
    <div class="survey-flow-strip" aria-label="填写进度">
      <span class="flow-step active">1 选择熟悉功能</span>
      <span class="flow-step" id="detailFlowStep">2 逐个详细评价</span>
      <span class="flow-step">3 写整体反馈</span>
    </div>
    <div class="selection-banner">
      <div>
        <strong id="selectedCount">已选择 0 个</strong>
        <span id="selectedAdvice">先把你能说出感受的功能加入清单；熟悉几个就选几个，可以全部评价。</span>
      </div>
      <div class="selection-actions">
        <button class="button primary" id="startEvaluationButton" type="button" data-action="start-evaluation" disabled>
          开始详细评价
        </button>
      </div>
    </div>
    <div class="feature-picker">
      ${Object.entries(groups)
        .map(([groupName, features]) => {
          return `
            <div class="repeat-item feature-group">
              <h3>${escapeHtml(groupName)}</h3>
              <div class="feature-list">
                ${features.map(renderFeatureCard).join('')}
              </div>
            </div>
          `;
        })
        .join('')}
    </div>
    <section id="evaluationWorkspace" class="evaluation-workspace" hidden></section>
    <div class="selection-dock" id="selectionDock" hidden>
      <div>
        <strong id="dockSelectedCount">已选择 0 个功能</strong>
        <span>选完就从这里进入详细评价，不用回到页面上方。</span>
      </div>
      <button class="button primary" type="button" data-action="start-evaluation">开始详细评价</button>
    </div>
  `;
}

function renderFeatureCard(feature) {
  return `
    <article class="feature-row feature-card" data-feature-card="${escapeAttr(feature.name)}">
      <div class="feature-title">
        <strong>${escapeHtml(feature.name)}</strong>
        <span>${escapeHtml(feature.description)}</span>
      </div>
      <div class="feature-actions">
        <button class="button small select-feature-button" type="button" data-action="toggle" data-feature="${escapeAttr(feature.name)}">
          选择评价
        </button>
      </div>
    </article>
  `;
}

function renderEvaluationWorkspace() {
  const workspace = document.getElementById('evaluationWorkspace');
  if (!workspace) return;

  const selectedFeatures = getSelectedFeatures();
  if (!selectedFeatures.length || !state.evaluationStarted) {
    workspace.hidden = true;
    workspace.innerHTML = !selectedFeatures.length
      ? ''
      : `
        <div class="empty-evaluation-hint">
          <strong>清单已选好</strong>
          <p>点击上面的“开始详细评价”，再逐个功能填写。这样页面不会一下子展开太多内容。</p>
        </div>
      `;
    return;
  }

  if (!state.activeFeature || !state.evaluations.has(state.activeFeature)) {
    state.activeFeature = selectedFeatures[0].name;
  }

  const feature = selectedFeatures.find((item) => item.name === state.activeFeature) || selectedFeatures[0];
  const evaluation = ensureEvaluation(feature.name);
  const activeStep = getActiveStep(feature.name);
  workspace.hidden = false;
  workspace.innerHTML = `
    <div class="workspace-head">
      <div>
        <h3>填写已选功能</h3>
        <p>每次只处理一个功能、一个步骤；切换功能不会丢失已填写内容。还想补选功能，可以回到上面的功能清单继续点选。</p>
      </div>
      <span class="workspace-count">${selectedFeatures.length} 个功能</span>
    </div>
    <div class="feature-tabs" role="tablist" aria-label="已选功能">
      ${selectedFeatures.map((item) => renderFeatureTab(item)).join('')}
    </div>
    <article class="step-shell" data-evaluation-panel="${escapeAttr(feature.name)}">
      <div class="step-feature-head">
        <div>
          <span class="panel-kicker">${escapeHtml(feature.group)}</span>
          <h3>${escapeHtml(feature.name)}</h3>
          <p>${escapeHtml(feature.description)}</p>
        </div>
        <button class="button small ghost-button" type="button" data-action="toggle" data-feature="${escapeAttr(feature.name)}">取消评价</button>
      </div>
      ${renderStepNav(feature.name)}
      <div class="step-body" data-step-panel="${escapeAttr(activeStep.id)}">
        ${renderActiveStep(feature, evaluation)}
      </div>
      ${renderStepControls(feature.name)}
    </article>
  `;
}

function renderFeatureTab(feature) {
  const active = feature.name === state.activeFeature;
  return `
    <button class="feature-tab${active ? ' active' : ''}" type="button" role="tab" aria-selected="${active}" data-action="activate" data-feature="${escapeAttr(feature.name)}">
      ${escapeHtml(feature.name)}
    </button>
  `;
}

function renderScoreQuestion(feature, question, evaluation) {
  const current = evaluation.answers[question.id];
  return `
    <div class="score-question" data-score-question="${question.id}">
      <div class="score-copy">
        <span class="question-kicker">判断项</span>
        <div class="label">${escapeHtml(question.text)}</div>
      </div>
      <div class="score-row">
        ${RESPONSE_SCALE
          .map(
            (option) => `
              <button class="seg small-score${current === option.value ? ' active' : ''}" type="button" data-action="score" data-feature="${escapeAttr(feature.name)}" data-question="${question.id}" data-value="${option.value}" aria-label="${escapeAttr(`${question.text}：${option.label}`)}">
                <strong>${escapeHtml(option.short)}</strong>
                <span>${escapeHtml(option.label)}</span>
              </button>
            `,
          )
          .join('')}
      </div>
    </div>
  `;
}

function renderStepNav(featureName) {
  const activeStep = getActiveStep(featureName);
  return `
    <div class="step-nav" role="tablist" aria-label="填写步骤">
      ${WORKSPACE_STEPS.map((step, index) => {
        const active = step.id === activeStep.id;
        return `
          <button class="step-pill${active ? ' active' : ''}" type="button" role="tab" aria-selected="${active}" data-action="step" data-feature="${escapeAttr(featureName)}" data-step="${escapeAttr(step.id)}">
            <span>${index + 1}</span>
            ${escapeHtml(step.label)}
          </button>
        `;
      }).join('')}
    </div>
  `;
}

function renderActiveStep(feature, evaluation) {
  const step = getActiveStep(feature.name);
  if (step.id === 'score') {
    return `
      ${renderStepIntro(step)}
      <div class="question-stack">
        ${feature.questions.map((question) => renderScoreQuestion(feature, question, evaluation)).join('')}
      </div>
    `;
  }

  if (step.id === 'problem') {
    return `
      ${renderStepIntro(step)}
      <div class="choice-cloud">
        ${feature.problemOptions
          .map((problem) => radioChip(`problem-${feature.name}`, problem, evaluation.mainProblem === problem))
          .join('')}
      </div>
      <label class="detail-field problem-detail-block">
        <span>为什么这是最大问题？</span>
        <textarea data-problem-detail placeholder="例如：规则只告诉我分配结果，但没有说明为什么这样分。我无法判断这是不是符合实际业务优先级，也不知道异常时该不该人工介入。">${escapeHtml(evaluation.problemDetail)}</textarea>
      </label>
    `;
  }

  if (step.id === 'liked') {
    return `
      ${renderStepIntro(step)}
      ${renderFeedbackSection(feature, evaluation, 'liked', '喜欢的点', '可选快捷项，也可以自己写', '具体说一个场景：它在哪个运营判断里帮到了你？')}
    `;
  }

  return `
    ${renderStepIntro(step)}
    ${renderFeedbackSection(feature, evaluation, 'disliked', '不喜欢/想改的点', '可选快捷项，也可以自己写', '具体说一个场景：哪一步让你犹豫、容易选错，或你希望怎么改？')}
  `;
}

function renderStepIntro(step) {
  return `
    <div class="step-intro">
      <strong>${escapeHtml(step.title)}</strong>
      <p>${escapeHtml(step.hint)}</p>
    </div>
  `;
}

function renderStepControls(featureName) {
  const step = getActiveStep(featureName);
  const stepIndex = WORKSPACE_STEPS.findIndex((item) => item.id === step.id);
  const previousFeature = getAdjacentFeature(featureName, -1);
  const nextFeature = getAdjacentFeature(featureName, 1);
  const previousDisabled = stepIndex === 0 && !previousFeature;
  const primaryLabel = stepIndex === WORKSPACE_STEPS.length - 1 ? (nextFeature ? '下一个功能' : '写整体反馈') : '下一步';
  return `
    <div class="step-controls">
      <button class="button ghost-button" type="button" data-action="step-prev" data-feature="${escapeAttr(featureName)}"${previousDisabled ? ' disabled' : ''}>上一步</button>
      <span class="step-progress">第 ${stepIndex + 1}/${WORKSPACE_STEPS.length} 步</span>
      <button class="button primary" type="button" data-action="step-next" data-feature="${escapeAttr(featureName)}">${primaryLabel}</button>
    </div>
  `;
}

function renderFeedbackSection(feature, evaluation, kind, title, hint, placeholder) {
  const options = kind === 'liked' ? feature.likeOptions : feature.dislikeOptions;
  const feedback = evaluation[kind];
  return `
    <div class="feedback-flow">
      <div class="feedback-head">
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(hint)}</span>
      </div>
      <div class="choice-cloud">
        ${options.map((option) => checkboxChip(feature.name, kind, option, feedback.points.includes(option))).join('')}
      </div>
      <div class="custom-point-row">
        <label>
          <span>自定义一个点</span>
          <input type="text" data-feedback-custom="${kind}" maxlength="24" value="${escapeAttr(feedback.customPoint)}" placeholder="没有合适选项，可以自己写">
        </label>
      </div>
      <textarea data-feedback-detail="${kind}" placeholder="${escapeAttr(placeholder)}">${escapeHtml(feedback.detail)}</textarea>
    </div>
  `;
}

function bindEvents() {
  document.getElementById('featureGroups').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const feature = button.dataset.feature;

    if (button.dataset.action === 'toggle') {
      toggleFeature(feature);
      return;
    }
    if (button.dataset.action === 'start-evaluation') {
      startEvaluation();
      return;
    }
    if (button.dataset.action === 'activate') {
      state.activeFeature = feature;
      renderEvaluationWorkspace();
      return;
    }
    if (button.dataset.action === 'step') {
      setActiveStep(feature, button.dataset.step);
      renderEvaluationWorkspace();
      return;
    }
    if (button.dataset.action === 'step-prev' || button.dataset.action === 'step-next') {
      moveStep(feature, button.dataset.action === 'step-next' ? 1 : -1);
      return;
    }
    if (button.dataset.action === 'score') {
      updateScore(button, feature, button.dataset.question, button.dataset.value);
    }
  });

  document.getElementById('featureGroups').addEventListener('change', (event) => {
    const input = event.target;
    const panel = input.closest('[data-evaluation-panel]');
    if (!panel) return;
    const feature = panel.dataset.evaluationPanel;
    const evaluation = ensureEvaluation(feature);

    if (input.name === `problem-${feature}`) {
      evaluation.mainProblem = input.value;
      return;
    }

    if (input.matches('input[data-feedback-kind]')) {
      updateFeedbackPoints(panel, evaluation, input);
    }
  });

  document.getElementById('featureGroups').addEventListener('input', (event) => {
    const problemDetail = event.target.closest('textarea[data-problem-detail]');
    if (problemDetail) {
      const panel = problemDetail.closest('[data-evaluation-panel]');
      const evaluation = ensureEvaluation(panel.dataset.evaluationPanel);
      evaluation.problemDetail = problemDetail.value;
      return;
    }

    const customInput = event.target.closest('input[data-feedback-custom]');
    if (customInput) {
      const panel = customInput.closest('[data-evaluation-panel]');
      const evaluation = ensureEvaluation(panel.dataset.evaluationPanel);
      evaluation[customInput.dataset.feedbackCustom].customPoint = customInput.value;
      return;
    }

    const textarea = event.target.closest('textarea[data-feedback-detail]');
    if (!textarea) return;
    const panel = textarea.closest('[data-evaluation-panel]');
    const evaluation = ensureEvaluation(panel.dataset.evaluationPanel);
    evaluation[textarea.dataset.feedbackDetail].detail = textarea.value;
  });

  form.addEventListener('submit', handleSubmit);
  document.getElementById('againButton').addEventListener('click', () => window.location.reload());
}

function toggleFeature(feature) {
  hideErrors();
  const selected = state.evaluations.has(feature);

  if (selected) {
    state.evaluations.delete(feature);
    state.activeSteps.delete(feature);
    if (state.activeFeature === feature) state.activeFeature = getSelectedFeatures()[0]?.name || '';
    if (state.evaluations.size === 0) state.evaluationStarted = false;
    syncFeatureCards();
    updateSelectedCount();
    renderEvaluationWorkspace();
    return;
  }

  ensureEvaluation(feature);
  state.activeFeature = feature;
  syncFeatureCards();
  updateSelectedCount();
  renderEvaluationWorkspace();
}

function startEvaluation() {
  hideErrors();
  if (!state.evaluations.size) {
    showErrors(['请先选择至少 1 个你熟悉的功能，再开始详细评价。']);
    return;
  }
  state.evaluationStarted = true;
  if (!state.activeFeature) state.activeFeature = getSelectedFeatures()[0]?.name || '';
  updateSelectedCount();
  renderEvaluationWorkspace();
  overallSection.hidden = false;
  submitArea.hidden = false;
  document.getElementById('evaluationWorkspace')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function getActiveStep(featureName) {
  const stepId = state.activeSteps.get(featureName);
  return WORKSPACE_STEPS.find((step) => step.id === stepId) || WORKSPACE_STEPS[0];
}

function setActiveStep(featureName, stepId) {
  if (!WORKSPACE_STEPS.some((step) => step.id === stepId)) return;
  state.activeSteps.set(featureName, stepId);
}

function moveStep(featureName, direction) {
  const step = getActiveStep(featureName);
  const stepIndex = WORKSPACE_STEPS.findIndex((item) => item.id === step.id);
  const nextIndex = stepIndex + direction;

  if (nextIndex >= 0 && nextIndex < WORKSPACE_STEPS.length) {
    setActiveStep(featureName, WORKSPACE_STEPS[nextIndex].id);
    renderEvaluationWorkspace();
    return;
  }

  const adjacentFeature = getAdjacentFeature(featureName, direction);
  if (adjacentFeature) {
    state.activeFeature = adjacentFeature.name;
    setActiveStep(
      adjacentFeature.name,
      direction > 0 ? WORKSPACE_STEPS[0].id : WORKSPACE_STEPS[WORKSPACE_STEPS.length - 1].id,
    );
    renderEvaluationWorkspace();
    return;
  }

  document.getElementById('favoritePoints')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  document.getElementById('favoritePoints')?.focus({ preventScroll: true });
}

function getAdjacentFeature(featureName, direction) {
  const selectedFeatures = getSelectedFeatures();
  const index = selectedFeatures.findIndex((feature) => feature.name === featureName);
  if (index < 0) return null;
  return selectedFeatures[index + direction] || null;
}

function syncFeatureCards() {
  document.querySelectorAll('[data-feature-card]').forEach((card) => {
    const feature = card.dataset.featureCard;
    const selected = state.evaluations.has(feature);
    const button = card.querySelector('[data-action="toggle"]');
    card.classList.toggle('selected', selected);
    button.classList.toggle('active', selected);
    button.textContent = selected ? '取消评价' : '选择评价';
  });
}

function updateSelectedCount() {
  const counter = document.getElementById('selectedCount');
  const advice = document.getElementById('selectedAdvice');
  const startButton = document.getElementById('startEvaluationButton');
  const detailStep = document.getElementById('detailFlowStep');
  const dock = document.getElementById('selectionDock');
  const dockSelectedCount = document.getElementById('dockSelectedCount');
  const count = state.evaluations.size;
  if (counter) counter.textContent = `已选择 ${count} 个`;
  if (startButton) {
    startButton.disabled = count === 0;
    startButton.textContent = state.evaluationStarted ? '继续详细评价' : '开始详细评价';
  }
  if (dock) dock.hidden = count === 0 || state.evaluationStarted;
  if (dockSelectedCount) dockSelectedCount.textContent = `已选择 ${count} 个功能`;
  if (overallSection) overallSection.hidden = !state.evaluationStarted;
  if (submitArea) submitArea.hidden = !state.evaluationStarted;
  if (detailStep) detailStep.classList.toggle('active', state.evaluationStarted);
  if (!advice) return;
  if (count === 0) {
    advice.textContent = '先把你能说出感受的功能加入清单；熟悉几个就选几个，可以全部评价。';
  } else if (count === 1) {
    advice.textContent = '已选 1 个，可以开始；如果还有熟悉功能，再补几个会更容易看出设计差异。';
  } else {
    advice.textContent = `已选 ${count} 个。熟悉的都可以评价，下一步会逐个展示，不会一次性铺开。`;
  }
}

function updateScore(button, feature, questionId, value) {
  const evaluation = ensureEvaluation(feature);
  evaluation.answers[questionId] = Number(value);

  button
    .closest('[data-score-question]')
    .querySelectorAll(`[data-action="score"][data-question="${questionId}"]`)
    .forEach((item) => item.classList.remove('active'));
  button.classList.add('active');
}

function updateFeedbackPoints(panel, evaluation, input) {
  const kind = input.dataset.feedbackKind;
  const selected = [...panel.querySelectorAll(`input[data-feedback-kind="${kind}"]:checked`)].map(
    (item) => item.value,
  );

  if (selected.length > 3) {
    input.checked = false;
    showErrors([`${evaluation.feature} 的${kind === 'liked' ? '喜欢' : '不喜欢'}点最多选 3 个`]);
    return;
  }

  evaluation[kind].points = selected;
}

function ensureEvaluation(feature) {
  if (!state.evaluations.has(feature)) {
    state.evaluations.set(feature, {
      feature,
      usage: 'used',
      answers: {},
      mainProblem: '',
      problemDetail: '',
      liked: { points: [], customPoint: '', detail: '' },
      disliked: { points: [], customPoint: '', detail: '' },
    });
  }
  return state.evaluations.get(feature);
}

async function handleSubmit(event) {
  event.preventDefault();
  hideErrors();
  formStatus.textContent = '提交中...';
  submitButton.disabled = true;

  try {
    const payload = buildPayload();
    const errors = validatePayload(payload);
    if (errors.length) {
      showErrors(errors);
      return;
    }

    if (
      payload.evaluations.length === 1 &&
      !window.confirm('你只评价了 1 个功能，也可以提交。若还有熟悉功能，多补 1 个会更有参考价值。继续提交吗？')
    ) {
      return;
    }

    const result = await fetchJson('/api/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!result.ok) {
      showErrors(result.errors || ['提交失败']);
      return;
    }

    form.hidden = true;
    successView.hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (error) {
    showErrors([`提交失败：${error.message}`]);
  } finally {
    submitButton.disabled = false;
    formStatus.textContent = '尚未提交';
  }
}

function buildPayload() {
  return {
    profile: {
      role: document.getElementById('role').value,
    },
    evaluations: [...state.evaluations.values()].map(serializeEvaluation),
    overall: {
      favoritePoints: document.getElementById('favoritePoints').value,
      dislikedPoints: document.getElementById('dislikedPoints').value,
      nextImprove: document.getElementById('nextImprove').value,
    },
  };
}

function validatePayload(payload) {
  const errors = [];
  if (!payload.profile.role.trim()) errors.push('请填写运营角色');
  if (!payload.evaluations.length) errors.push('请至少选择 1 个熟悉功能评价');

  payload.evaluations.forEach((evaluation) => {
    const feature = state.config.features.find((item) => item.name === evaluation.feature);
    const missing = (feature?.questions || []).filter(
      (question) => !Number.isInteger(evaluation.answers[question.id]),
    );
    if (missing.length) errors.push(`${evaluation.feature} 还有问题未评分`);
    if (!evaluation.mainProblem) errors.push(`${evaluation.feature} 请选择最大问题`);
    if (!evaluation.problemDetail.trim()) errors.push(`${evaluation.feature} 请说明为什么这是最大问题`);
    if (!evaluation.liked.points.length) errors.push(`${evaluation.feature} 请至少选择一个喜欢的点`);
    if (!evaluation.liked.detail.trim()) errors.push(`${evaluation.feature} 请写清楚喜欢点的具体价值`);
    if (!evaluation.disliked.points.length) errors.push(`${evaluation.feature} 请至少选择一个不喜欢的点`);
    if (!evaluation.disliked.detail.trim()) errors.push(`${evaluation.feature} 请写清楚不喜欢/想改点的具体场景`);
    if (evaluation.liked.points.length > 3) errors.push(`${evaluation.feature} 喜欢的点最多选 3 个`);
    if (evaluation.disliked.points.length > 3) errors.push(`${evaluation.feature} 不喜欢的点最多选 3 个`);
  });

  return [...new Set(errors)];
}

function serializeEvaluation(evaluation) {
  return {
    ...evaluation,
    liked: serializeFeedback(evaluation.liked),
    disliked: serializeFeedback(evaluation.disliked),
  };
}

function serializeFeedback(feedback) {
  return {
    points: uniquePoints([...(feedback.points || []), feedback.customPoint]),
    detail: feedback.detail || '',
  };
}

function uniquePoints(points) {
  return [...new Set(points.map((point) => String(point || '').trim()).filter(Boolean))];
}

function getSelectedFeatures() {
  return [...state.evaluations.keys()]
    .map((featureName) => state.config.features.find((feature) => feature.name === featureName))
    .filter(Boolean);
}

function radioChip(name, value, checked = false) {
  return `
    <label class="chip">
      <input type="radio" name="${escapeAttr(name)}" value="${escapeAttr(value)}"${checked ? ' checked' : ''}>
      <span>${escapeHtml(value)}</span>
    </label>
  `;
}

function checkboxChip(feature, kind, value, checked = false) {
  return `
    <label class="chip">
      <input type="checkbox" name="${escapeAttr(`${kind}-${feature}`)}" value="${escapeAttr(value)}" data-feedback-kind="${kind}"${checked ? ' checked' : ''}>
      <span>${escapeHtml(value)}</span>
    </label>
  `;
}

function groupBy(items, key) {
  return items.reduce((groups, item) => {
    const groupName = item[key] || '其他';
    groups[groupName] ||= [];
    groups[groupName].push(item);
    return groups;
  }, {});
}

function showErrors(errors) {
  errorBox.innerHTML = errors.map((error) => `<div>${escapeHtml(error)}</div>`).join('');
  errorBox.classList.add('show');
  errorBox.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

function hideErrors() {
  errorBox.classList.remove('show');
  errorBox.innerHTML = '';
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
