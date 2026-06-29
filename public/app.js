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
    label: '使用感受',
    title: '先选择实际使用感受',
    hint: '不用打分，直接选择最接近你实际感受的一项。',
  },
  {
    id: 'problem',
    label: '最大问题',
    title: '先选最影响使用的一类问题',
    hint: '选完后请补充一个具体场景，说明它在哪一步影响了你。',
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
  { value: 1, label: '很难用', short: '很难用' },
  { value: 2, label: '不太顺', short: '不太顺' },
  { value: 3, label: '一般', short: '一般' },
  { value: 4, label: '比较顺', short: '比较顺' },
  { value: 5, label: '很好用', short: '很好用' },
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
      <span class="flow-step" id="overallFlowStep">3 补充说明</span>
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
              <div class="feature-group-head">
                <h3>${escapeHtml(groupName)}</h3>
                <span>${features.length} 个功能</span>
              </div>
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
        <span class="feature-description">${escapeHtml(feature.description)}</span>
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
  const currentMissing = getEvaluationMissingItems(feature, evaluation);
  const completedCount = selectedFeatures.filter((item) => isEvaluationComplete(ensureEvaluation(item.name))).length;
  workspace.hidden = false;
  workspace.innerHTML = `
    <div class="workspace-head">
      <div>
        <span class="workspace-label">第 2 步</span>
        <h3>逐个评价已选功能</h3>
        <p>左侧切换功能，右侧填写当前功能。全部必填项完成后，才会出现补充说明和提交按钮。</p>
      </div>
      <span class="workspace-count">已完成 ${completedCount}/${selectedFeatures.length}</span>
    </div>
    <div class="evaluation-layout">
      <aside class="feature-rail" aria-label="已选功能列表">
        <div class="rail-head">
          <strong>已选功能</strong>
          <span>${selectedFeatures.length} 个</span>
        </div>
        <div class="feature-tabs" role="tablist" aria-label="已选功能">
          ${selectedFeatures.map((item) => renderFeatureTab(item)).join('')}
        </div>
        ${renderCompletionNotice(selectedFeatures)}
      </aside>
      <article class="step-shell" data-evaluation-panel="${escapeAttr(feature.name)}">
        <div class="step-feature-head">
          <div class="feature-context">
            <span class="feature-group-label">${escapeHtml(feature.group)}</span>
            <h3>${escapeHtml(feature.name)}</h3>
            <p>${escapeHtml(feature.description)}</p>
          </div>
          <div class="feature-context-side">
            <span class="feature-complete-pill${currentMissing.length ? '' : ' done'}" title="${escapeAttr(currentMissing.map((item) => item.label).join('、'))}">
              ${currentMissing.length ? `还差：${escapeHtml(currentMissing[0].label)}` : '本功能已完成'}
            </span>
            <button class="button small ghost-button" type="button" data-action="toggle" data-feature="${escapeAttr(feature.name)}">取消评价</button>
          </div>
        </div>
        ${renderCurrentMissing(feature, evaluation)}
        ${renderStepNav(feature.name)}
        <div class="step-body" data-step-panel="${escapeAttr(activeStep.id)}">
          ${renderActiveStep(feature, evaluation)}
        </div>
        ${renderStepControls(feature.name)}
      </article>
    </div>
  `;
}

function renderFeatureTab(feature) {
  const active = feature.name === state.activeFeature;
  const complete = isEvaluationComplete(ensureEvaluation(feature.name));
  return `
    <button class="feature-tab${active ? ' active' : ''}${complete ? ' complete' : ''}" type="button" role="tab" aria-selected="${active}" data-action="activate" data-feature="${escapeAttr(feature.name)}">
      <span class="tab-copy">
        <strong>${escapeHtml(feature.name)}</strong>
        <small>${escapeHtml(feature.group)}</small>
      </span>
      <span class="tab-status" data-tab-status>${complete ? '已完成' : '未完成'}</span>
    </button>
  `;
}

function renderCompletionNotice(selectedFeatures) {
  const completed = selectedFeatures.filter((feature) => isEvaluationComplete(ensureEvaluation(feature.name))).length;
  const total = selectedFeatures.length;
  const ready = total > 0 && completed === total;
  return `
    <div class="completion-notice${ready ? ' ready' : ''}">
      <strong>${ready ? '已完成所有功能评价' : `已完成 ${completed}/${total} 个功能评价`}</strong>
      <p>${ready ? '现在可以填写补充说明并提交。' : '每个已选功能的所有必填项完成后，才会显示补充说明和提交按钮。'}</p>
    </div>
  `;
}

function renderCurrentMissing(feature, evaluation) {
  const missing = getEvaluationMissingItems(feature, evaluation);
  if (!missing.length) {
    return `
      <div class="current-status done">
        <strong>这个功能已填完整</strong>
        <span>可以继续填写其他已选功能；全部完成后会出现补充说明和提交按钮。</span>
      </div>
    `;
  }
  return `
    <div class="current-status">
      <strong>完成这些项后，本功能才算填完</strong>
      <div class="missing-list">
        ${missing.map((item) => `<span>${escapeHtml(item.label)}</span>`).join('')}
      </div>
    </div>
  `;
}

function renderScoreQuestion(feature, question, evaluation) {
  const current = evaluation.answers[question.id];
  return `
    <div class="score-question" data-score-question="${question.id}">
      <div class="score-copy">
        <span class="question-kicker">请按实际感受选择 <b class="required-star">*</b></span>
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
      <div class="field-label-line">选择最影响使用的一类问题 <b class="required-star">*</b></div>
      <div class="choice-cloud">
        ${feature.problemOptions
          .map((problem) => radioChip(`problem-${feature.name}`, problem, evaluation.mainProblem === problem))
          .join('')}
      </div>
      <label class="detail-field problem-detail-block">
        <span>为什么这是最大问题？ <b class="required-star">*</b></span>
        <textarea data-problem-detail data-required-field="problemDetail" placeholder="例如：只看到分配结果，看不到原因，遇到异常时不知道要不要人工处理。">${escapeHtml(evaluation.problemDetail)}</textarea>
      </label>
    `;
  }

  if (step.id === 'liked') {
    return `
      ${renderStepIntro(step)}
      ${renderFeedbackSection(feature, evaluation, 'liked', '喜欢的点', '可选快捷项，也可以自己写', '具体说一个场景：什么时候让你觉得它好用？')}
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
  const primaryLabel = stepIndex === WORKSPACE_STEPS.length - 1 ? (nextFeature ? '下一个功能' : '写补充说明') : '下一步';
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
        <strong>${escapeHtml(title)} <b class="required-star">*</b></strong>
        <span>选一个快捷项，或在下面自己写一个；不用两边都填</span>
      </div>
      <div class="choice-cloud">
        ${options.map((option) => checkboxChip(feature.name, kind, option, feedback.points.includes(option))).join('')}
      </div>
      <div class="custom-point-row">
        <label>
          <span>自定义一个点 <small>选项不合适时再写</small></span>
          <input type="text" data-feedback-custom="${kind}" maxlength="24" value="${escapeAttr(feedback.customPoint)}" placeholder="已选上方选项时，这里可以不填">
        </label>
      </div>
      <label class="detail-field feedback-detail-field">
        <span>具体说明 <b class="required-star">*</b></span>
        <textarea data-feedback-detail="${kind}" placeholder="${escapeAttr(placeholder)}">${escapeHtml(feedback.detail)}</textarea>
      </label>
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
      updateSelectedCount();
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
      updateSelectedCount();
      return;
    }

    const customInput = event.target.closest('input[data-feedback-custom]');
    if (customInput) {
      const panel = customInput.closest('[data-evaluation-panel]');
      const evaluation = ensureEvaluation(panel.dataset.evaluationPanel);
      evaluation[customInput.dataset.feedbackCustom].customPoint = customInput.value;
      updateSelectedCount();
      return;
    }

    const textarea = event.target.closest('textarea[data-feedback-detail]');
    if (!textarea) return;
    const panel = textarea.closest('[data-evaluation-panel]');
    const evaluation = ensureEvaluation(panel.dataset.evaluationPanel);
    evaluation[textarea.dataset.feedbackDetail].detail = textarea.value;
    updateSelectedCount();
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

  if (direction > 0) {
    const evaluation = ensureEvaluation(featureName);
    const missingInCurrentStep = getStepMissingItems(evaluation, step.id);
    if (missingInCurrentStep.length) {
      renderEvaluationWorkspace();
      showInlineMissing(missingInCurrentStep[0].label);
      focusFirstMissingField(missingInCurrentStep[0]);
      return;
    }
  }

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

  if (allSelectedEvaluationsComplete()) {
    updateSelectedCount();
    document.getElementById('favoritePoints')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    document.getElementById('favoritePoints')?.focus({ preventScroll: true });
    return;
  }

  const nextIncomplete = getSelectedFeatures().find((item) => !isEvaluationComplete(ensureEvaluation(item.name)));
  if (nextIncomplete) {
    state.activeFeature = nextIncomplete.name;
    setActiveStep(nextIncomplete.name, getFirstIncompleteStep(ensureEvaluation(nextIncomplete.name)));
    renderEvaluationWorkspace();
    const firstMissing = getEvaluationMissingItems(nextIncomplete, ensureEvaluation(nextIncomplete.name))[0];
    showErrors([`${nextIncomplete.name} 还缺：${firstMissing?.label || '必填项'}。补完后才会显示补充说明和提交按钮。`]);
    focusFirstMissingField(firstMissing);
  }
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
  const overallStep = document.getElementById('overallFlowStep');
  const dock = document.getElementById('selectionDock');
  const dockSelectedCount = document.getElementById('dockSelectedCount');
  const count = state.evaluations.size;
  const readyForOverall = state.evaluationStarted && count > 0 && allSelectedEvaluationsComplete();
  if (counter) counter.textContent = `已选择 ${count} 个`;
  if (startButton) {
    startButton.disabled = count === 0;
    startButton.textContent = state.evaluationStarted ? '继续详细评价' : '开始详细评价';
  }
  if (dock) dock.hidden = count === 0 || state.evaluationStarted;
  if (dockSelectedCount) dockSelectedCount.textContent = `已选择 ${count} 个功能`;
  if (overallSection) overallSection.hidden = !readyForOverall;
  if (submitArea) submitArea.hidden = !readyForOverall;
  if (detailStep) detailStep.classList.toggle('active', state.evaluationStarted);
  if (overallStep) overallStep.classList.toggle('active', readyForOverall);
  syncEvaluationCompletionUi();
  if (!advice) return;
  if (count === 0) {
    advice.textContent = '先把你能说出感受的功能加入清单；熟悉几个就选几个，可以全部评价。';
  } else if (count === 1) {
    advice.textContent = '已选 1 个，可以开始；如果还有熟悉功能，再补几个会更容易对比使用感受。';
  } else {
    advice.textContent = `已选 ${count} 个。熟悉的都可以评价，下一步会逐个展示，不会一次性铺开。`;
  }
}

function syncEvaluationCompletionUi() {
  const selectedFeatures = getSelectedFeatures();
  const completed = selectedFeatures.filter((feature) => isEvaluationComplete(ensureEvaluation(feature.name))).length;
  const total = selectedFeatures.length;
  const ready = total > 0 && completed === total;
  const notice = document.querySelector('.completion-notice');
  if (notice) {
    notice.classList.toggle('ready', ready);
    const title = notice.querySelector('strong');
    const copy = notice.querySelector('p');
    if (title) title.textContent = ready ? '已完成所有功能评价' : `已完成 ${completed}/${total} 个功能评价`;
    if (copy) copy.textContent = ready ? '现在可以填写补充说明并提交。' : '每个已选功能的所有必填项完成后，才会显示补充说明和提交按钮。';
  }
  document.querySelectorAll('.feature-tab[data-feature]').forEach((tab) => {
    const evaluation = ensureEvaluation(tab.dataset.feature);
    const complete = isEvaluationComplete(evaluation);
    tab.classList.toggle('complete', complete);
    const status = tab.querySelector('[data-tab-status]');
    if (status) status.textContent = complete ? '已完成' : '未完成';
  });
}

function updateScore(button, feature, questionId, value) {
  const evaluation = ensureEvaluation(feature);
  evaluation.answers[questionId] = Number(value);

  button
    .closest('[data-score-question]')
    .querySelectorAll(`[data-action="score"][data-question="${questionId}"]`)
    .forEach((item) => item.classList.remove('active'));
  button.classList.add('active');
  updateSelectedCount();
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
  updateSelectedCount();
}

function allSelectedEvaluationsComplete() {
  return state.evaluations.size > 0 && [...state.evaluations.values()].every(isEvaluationComplete);
}

function isEvaluationComplete(evaluation) {
  const feature = state.config?.features.find((item) => item.name === evaluation.feature);
  if (!feature) return false;
  const allScoresDone = feature.questions.every((question) => Number.isInteger(evaluation.answers?.[question.id]));
  return (
    allScoresDone &&
    Boolean(evaluation.mainProblem) &&
    Boolean(String(evaluation.problemDetail || '').trim()) &&
    hasPointFeedback(evaluation.liked) &&
    hasPointFeedback(evaluation.disliked)
  );
}

function hasPointFeedback(feedback) {
  const points = uniquePoints([...(feedback?.points || []), feedback?.customPoint]);
  return points.length > 0 && Boolean(String(feedback?.detail || '').trim());
}

function getFirstIncompleteStep(evaluation) {
  const feature = state.config?.features.find((item) => item.name === evaluation.feature);
  if (!feature) return WORKSPACE_STEPS[0].id;
  if (!feature.questions.every((question) => Number.isInteger(evaluation.answers?.[question.id]))) return 'score';
  if (!evaluation.mainProblem || !String(evaluation.problemDetail || '').trim()) return 'problem';
  if (!hasPointFeedback(evaluation.liked)) return 'liked';
  if (!hasPointFeedback(evaluation.disliked)) return 'disliked';
  return WORKSPACE_STEPS[0].id;
}

function getEvaluationMissingLabels(feature, evaluation) {
  return getEvaluationMissingItems(feature, evaluation).map((item) => item.label);
}

function getEvaluationMissingItems(feature, evaluation) {
  const missing = [];
  const unansweredCount = feature.questions.filter(
    (question) => !Number.isInteger(evaluation.answers?.[question.id]),
  ).length;
  if (unansweredCount) missing.push({ label: `使用感受 ${unansweredCount} 题`, step: 'score', field: 'score' });
  if (!evaluation.mainProblem) missing.push({ label: '最大问题选项', step: 'problem', field: 'problem' });
  if (!String(evaluation.problemDetail || '').trim()) {
    missing.push({ label: '最大问题的具体说明', step: 'problem', field: 'problemDetail' });
  }
  if (!feedbackPointsComplete(evaluation.liked)) {
    missing.push({ label: '喜欢点至少选一个', step: 'liked', field: 'likedPoint' });
  }
  if (!String(evaluation.liked?.detail || '').trim()) {
    missing.push({ label: '喜欢点的具体说明', step: 'liked', field: 'likedDetail' });
  }
  if (!feedbackPointsComplete(evaluation.disliked)) {
    missing.push({ label: '想改点至少选一个', step: 'disliked', field: 'dislikedPoint' });
  }
  if (!String(evaluation.disliked?.detail || '').trim()) {
    missing.push({ label: '想改点的具体说明', step: 'disliked', field: 'dislikedDetail' });
  }
  return missing;
}

function getStepMissingItems(evaluation, stepId) {
  const feature = state.config?.features.find((item) => item.name === evaluation.feature);
  if (!feature) return [];
  return getEvaluationMissingItems(feature, evaluation).filter((item) => item.step === stepId);
}

function feedbackPointsComplete(feedback) {
  return uniquePoints([...(feedback?.points || []), feedback?.customPoint]).length > 0;
}

function showInlineMissing(label) {
  const status = document.querySelector('.current-status');
  if (status) {
    status.classList.add('attention');
    const title = status.querySelector('strong');
    if (title) title.textContent = `还缺：${label}`;
  }
}

function focusFirstMissingField(item) {
  if (!item) return;
  const selectors = {
    score: '[data-action="score"]:not(.active)',
    problem: '.choice-cloud input[type="radio"]',
    problemDetail: '[data-problem-detail]',
    likedPoint: '[data-feedback-kind="liked"], [data-feedback-custom="liked"]',
    likedDetail: '[data-feedback-detail="liked"]',
    dislikedPoint: '[data-feedback-kind="disliked"], [data-feedback-custom="disliked"]',
    dislikedDetail: '[data-feedback-detail="disliked"]',
  };
  const target = document.querySelector(selectors[item.field]);
  if (!target) return;
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  target.focus({ preventScroll: true });
  target.classList.add('field-attention');
  window.setTimeout(() => target.classList.remove('field-attention'), 1400);
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
