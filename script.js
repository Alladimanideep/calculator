/**
 * AuraCalc — Next-Gen Scientific & Standard Calculator
 * Comprehensive calculation engine, Web Audio synthesis, History, and Unit Converter
 */

(() => {
  'use strict';

  // ==========================================================================
  // State Management
  // ==========================================================================
  const state = {
    expression: '',
    lastResult: '0',
    justCalculated: false,
    angleMode: 'DEG', // 'DEG' or 'RAD'
    soundEnabled: true,
    theme: 'dark',
    memoryValue: 0,
    history: [],
    currentMode: 'standard', // 'standard', 'scientific', 'converter'
  };

  // LocalStorage Keys
  const STORAGE_KEYS = {
    HISTORY: 'auracalc_history_v1',
    SOUND: 'auracalc_sound_v1',
    THEME: 'auracalc_theme_v1',
    ANGLE: 'auracalc_angle_v1',
  };

  // ==========================================================================
  // DOM Elements
  // ==========================================================================
  const app = document.getElementById('calculatorApp');
  const expressionText = document.getElementById('expressionText');
  const livePreview = document.getElementById('livePreview');
  const primaryResult = document.getElementById('primaryResult');
  const angleUnitBadge = document.getElementById('angleUnitBadge');
  const memoryBadge = document.getElementById('memoryBadge');
  const engineModeBadge = document.getElementById('engineModeBadge');
  const copyResultBtn = document.getElementById('copyResultBtn');

  // Tabs
  const tabStandard = document.getElementById('tabStandard');
  const tabScientific = document.getElementById('tabScientific');
  const tabConverter = document.getElementById('tabConverter');
  const mainKeypad = document.getElementById('mainKeypad');
  const converterPanel = document.getElementById('converterPanel');

  // Controls
  const soundToggle = document.getElementById('soundToggle');
  const soundOnIcon = soundToggle.querySelector('.sound-on-icon');
  const soundOffIcon = soundToggle.querySelector('.sound-off-icon');
  const themeToggle = document.getElementById('themeToggle');
  const sunIcon = themeToggle.querySelector('.sun-icon');
  const moonIcon = themeToggle.querySelector('.moon-icon');

  // History Elements
  const historyToggle = document.getElementById('historyToggle');
  const historyDrawer = document.getElementById('historyDrawer');
  const closeHistoryBtn = document.getElementById('closeHistoryBtn');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');
  const historyList = document.getElementById('historyList');
  const historyCount = document.getElementById('historyCount');
  const drawerBackdrop = document.getElementById('drawerBackdrop');

  // Keyboard Modal
  const keyboardHelpTrigger = document.getElementById('keyboardHelpTrigger');
  const keyboardModal = document.getElementById('keyboardModal');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const toast = document.getElementById('toast');

  // Converter DOM
  const convCatButtons = document.querySelectorAll('.conv-cat-btn');
  const convFromUnit = document.getElementById('convFromUnit');
  const convToUnit = document.getElementById('convToUnit');
  const convFromValue = document.getElementById('convFromValue');
  const convResultDisplay = document.getElementById('convResultDisplay');
  const convSwapBtn = document.getElementById('convSwapBtn');
  const convFormula = document.getElementById('convFormula');

  // ==========================================================================
  // Web Audio Synthesizer (Zero External Assets)
  // ==========================================================================
  let audioCtx = null;

  function initAudio() {
    if (!audioCtx && (window.AudioContext || window.webkitAudioContext)) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  function playTone(freq, type = 'sine', duration = 0.04, gainLevel = 0.1) {
    if (!state.soundEnabled) return;
    try {
      initAudio();
      if (!audioCtx) return;
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

      gain.gain.setValueAtTime(gainLevel, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch {
      // AudioContext policy suppression gracefully handled
    }
  }

  const soundFx = {
    tap: () => playTone(600, 'sine', 0.03, 0.08),
    operator: () => playTone(880, 'triangle', 0.04, 0.09),
    func: () => playTone(1050, 'sine', 0.04, 0.07),
    calculate: () => {
      playTone(523.25, 'triangle', 0.08, 0.12);
      setTimeout(() => playTone(659.25, 'triangle', 0.08, 0.1), 40);
      setTimeout(() => playTone(783.99, 'sine', 0.12, 0.1), 80);
    },
    clear: () => playTone(300, 'sine', 0.06, 0.1),
    error: () => playTone(180, 'sawtooth', 0.12, 0.12),
  };

  // ==========================================================================
  // Toast Helper
  // ==========================================================================
  let toastTimer = null;
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 2200);
  }

  // ==========================================================================
  // Math Parser & Evaluator
  // ==========================================================================
  function factorial(n) {
    if (n < 0 || !Number.isInteger(n)) return NaN;
    if (n === 0 || n === 1) return 1;
    if (n > 170) return Infinity; // JS max float limit
    let res = 1;
    for (let i = 2; i <= n; i++) res *= i;
    return res;
  }

  /**
   * Prepares and evaluates an expression safely
   */
  function evaluateExpression(rawExp) {
    if (!rawExp || !rawExp.trim()) return null;

    let expr = rawExp;

    // Normalizing characters
    expr = expr.replace(/×/g, '*');
    expr = expr.replace(/÷/g, '/');
    expr = expr.replace(/−/g, '-');
    expr = expr.replace(/π/g, `(${Math.PI})`);
    expr = expr.replace(/\be\b/g, `(${Math.E})`);

    // Handle percentage:
    // e.g., 50 + 10% -> 50 + (50 * 0.1) or standalone X% -> (X / 100)
    expr = expr.replace(/(\d+(\.\d+)?)%/g, '($1/100)');

    // Handle Factorials: e.g. 5! -> factorial(5)
    expr = expr.replace(/(\d+)!/g, 'factorial($1)');

    // Handle Powers: replace ^ with **
    expr = expr.replace(/\^/g, '**');

    // Square Root: √(x) -> Math.sqrt(x)
    expr = expr.replace(/√\(/g, 'Math.sqrt(');

    // Auto-balance parentheses
    let openCount = (expr.match(/\(/g) || []).length;
    let closeCount = (expr.match(/\)/g) || []).length;
    while (openCount > closeCount) {
      expr += ')';
      closeCount++;
    }

    // Prepare trigonometry conversions based on DEG vs RAD
    const isDeg = state.angleMode === 'DEG';
    const toRad = deg => deg * (Math.PI / 180);
    const fromRad = rad => rad * (180 / Math.PI);

    const sin = x => isDeg ? Math.sin(toRad(x)) : Math.sin(x);
    const cos = x => isDeg ? Math.cos(toRad(x)) : Math.cos(x);
    const tan = x => {
      const res = isDeg ? Math.tan(toRad(x)) : Math.tan(x);
      // Precision check for tan(90 deg)
      if (isDeg && Math.abs(x % 180) === 90) return Infinity;
      return res;
    };
    const asin = x => isDeg ? fromRad(Math.asin(x)) : Math.asin(x);
    const acos = x => isDeg ? fromRad(Math.acos(x)) : Math.acos(x);
    const atan = x => isDeg ? fromRad(Math.atan(x)) : Math.atan(x);
    const log = x => Math.log10(x);
    const ln = x => Math.log(x);

    // Context sandbox for safe evaluation without raw window access
    try {
      // Whitelist permitted math tokens
      const mathScope = {
        Math,
        factorial,
        sin, cos, tan,
        asin, acos, atan,
        log, ln,
      };

      // Construct scoped evaluator
      const scopeKeys = Object.keys(mathScope);
      const scopeValues = Object.values(mathScope);
      const evaluator = new Function(...scopeKeys, `"use strict"; return (${expr});`);
      const result = evaluator(...scopeValues);

      if (typeof result !== 'number' || isNaN(result)) {
        return null;
      }

      // Check division by zero or infinite
      if (!isFinite(result)) {
        return result > 0 ? 'Infinity' : '-Infinity';
      }

      // Clean floating-point artifacts (e.g. 0.1 + 0.2 = 0.3)
      return cleanPrecision(result);
    } catch {
      return null;
    }
  }

  function cleanPrecision(num) {
    if (typeof num === 'string') return num;
    if (Math.abs(num) < 1e-12 && Math.abs(num) > 0) return 0;
    // Format to 11 significant digits to eliminate float drift
    const rounded = parseFloat(num.toPrecision(12));
    // If integer, return directly
    return rounded.toString();
  }

  function formatDisplayNumber(valStr) {
    if (!valStr) return '0';
    if (valStr === 'Error' || valStr === 'Infinity' || valStr === '-Infinity') return valStr;

    // Check if it's a valid numeric string
    const parts = valStr.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  }

  // ==========================================================================
  // Display & UI Updating
  // ==========================================================================
  function updateDisplay() {
    // 1. Render syntax-highlighted expression
    renderExpressionHighlight(state.expression);

    // 2. Compute Live Preview
    if (state.expression && !state.justCalculated) {
      const preview = evaluateExpression(state.expression);
      if (preview !== null && preview.toString() !== state.expression.trim()) {
        livePreview.textContent = `= ${formatDisplayNumber(preview.toString())}`;
        livePreview.classList.add('active');
      } else {
        livePreview.textContent = '';
        livePreview.classList.remove('active');
      }
    } else {
      livePreview.textContent = '';
      livePreview.classList.remove('active');
    }

    // 3. Render Primary Result
    const resText = state.lastResult;
    primaryResult.textContent = formatDisplayNumber(resText);

    // Adjust font size dynamically if number is long
    primaryResult.className = 'primary-result';
    if (resText === 'Error') {
      primaryResult.classList.add('error-state');
    } else if (resText.length > 14) {
      primaryResult.classList.add('size-tiny');
    } else if (resText.length > 10) {
      primaryResult.classList.add('size-small');
    } else if (resText.length > 7) {
      primaryResult.classList.add('size-medium');
    }

    // Auto-scroll expression bar to rightmost position
    const expWrapper = document.getElementById('expressionWrapper');
    if (expWrapper) {
      expWrapper.scrollLeft = expWrapper.scrollWidth;
    }
  }

  function renderExpressionHighlight(expr) {
    if (!expr) {
      expressionText.innerHTML = '';
      return;
    }

    // Split expression into tokens: numbers, operators, functions, parentheses
    const tokenRegex = /(\d+(\.\d+)?|[+\-×÷^%]|sin\(|cos\(|tan\(|asin\(|acos\(|atan\(|log\(|ln\(|√\(|1\/\(|\(|\)|π|e|!)/g;

    let html = '';
    let lastIndex = 0;
    let match;

    while ((match = tokenRegex.exec(expr)) !== null) {
      if (match.index > lastIndex) {
        html += escapeHtml(expr.substring(lastIndex, match.index));
      }

      const token = match[0];
      if (/^[+\-×÷^%]$/.test(token)) {
        html += `<span class="token-op">${escapeHtml(token)}</span>`;
      } else if (/^[()]$/.test(token)) {
        html += `<span class="token-paren">${escapeHtml(token)}</span>`;
      } else if (/^(π|e)$/.test(token)) {
        html += `<span class="token-const">${escapeHtml(token)}</span>`;
      } else if (/^[a-z√1]/i.test(token)) {
        html += `<span class="token-func">${escapeHtml(token)}</span>`;
      } else {
        html += escapeHtml(token);
      }
      lastIndex = tokenRegex.lastIndex;
    }

    if (lastIndex < expr.length) {
      html += escapeHtml(expr.substring(lastIndex));
    }

    expressionText.innerHTML = html;
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // ==========================================================================
  // Calculator Actions
  // ==========================================================================
  function handleInput(val) {
    soundFx.tap();

    // If calculation just finished and a new number/function is pressed, start fresh
    if (state.justCalculated) {
      if (/^[0-9.πe]$/.test(val) || /^[a-z√]/i.test(val)) {
        state.expression = '';
      } else if (/^[+−×÷^%]$/.test(val)) {
        // Carry forward previous result
        state.expression = state.lastResult;
      }
      state.justCalculated = false;
    }

    // Avoid consecutive invalid operators
    const isOp = /^[+−×÷^%]$/.test(val);
    const lastChar = state.expression.slice(-1);

    if (isOp && /^[+−×÷^%]$/.test(lastChar)) {
      // Replace last operator with new one
      state.expression = state.expression.slice(0, -1) + val;
    } else {
      state.expression += val;
    }

    updateDisplay();
  }

  function handleBackspace() {
    soundFx.tap();
    if (state.justCalculated) {
      state.expression = '';
      state.justCalculated = false;
      state.lastResult = '0';
    } else if (state.expression.length > 0) {
      // Check if deleting function like 'sin(' or 'log('
      const funcMatch = state.expression.match(/(sin\(|cos\(|tan\(|asin\(|acos\(|atan\(|log\(|ln\(|√\(|1\/\()$/);
      if (funcMatch) {
        state.expression = state.expression.slice(0, -funcMatch[0].length);
      } else {
        state.expression = state.expression.slice(0, -1);
      }
    }
    updateDisplay();
  }

  function handleClearAll() {
    soundFx.clear();
    state.expression = '';
    state.lastResult = '0';
    state.justCalculated = false;
    updateDisplay();
  }

  function handleParentheses() {
    soundFx.operator();
    const openCount = (state.expression.match(/\(/g) || []).length;
    const closeCount = (state.expression.match(/\)/g) || []).length;
    const lastChar = state.expression.slice(-1);

    // If more open parens and last char isn't an operator or open paren, close it
    if (openCount > closeCount && !/[+\-×÷^(]/.test(lastChar) && state.expression.length > 0) {
      state.expression += ')';
    } else {
      // If preceding character is a number or constant, add an implicit multiplication
      if (/[\dπe)]$/.test(state.expression)) {
        state.expression += '×(';
      } else {
        state.expression += '(';
      }
    }
    state.justCalculated = false;
    updateDisplay();
  }

  function handleNegate() {
    soundFx.operator();
    if (!state.expression) {
      if (state.lastResult !== '0' && state.lastResult !== 'Error') {
        state.expression = `−(${state.lastResult})`;
      } else {
        state.expression = '−';
      }
    } else {
      // If matches trailing number, wrap in negation
      const match = state.expression.match(/(\d+(\.\d+)?)$/);
      if (match) {
        const num = match[0];
        const start = match.index;
        // Check if preceded by minus
        if (state.expression.slice(start - 1, start) === '−') {
          state.expression = state.expression.slice(0, start - 1) + num;
        } else {
          state.expression = `${state.expression.slice(0, start)}−${num}`;
        }
      } else {
        state.expression += '−';
      }
    }
    updateDisplay();
  }

  function handleCalculate() {
    if (!state.expression) return;

    const result = evaluateExpression(state.expression);
    if (result === null || result === 'Error') {
      soundFx.error();
      state.lastResult = 'Error';
    } else {
      soundFx.calculate();
      const finalRes = result.toString();
      // Add to History
      addHistoryItem(state.expression, finalRes);
      state.lastResult = finalRes;
      state.justCalculated = true;
    }

    updateDisplay();
  }

  // ==========================================================================
  // Memory Registers
  // ==========================================================================
  function handleMemory(action) {
    soundFx.func();
    const currentNum = parseFloat(state.lastResult) || 0;

    switch (action) {
      case 'mem-clear':
        state.memoryValue = 0;
        showToast('Memory Cleared');
        break;
      case 'mem-recall':
        handleInput(state.memoryValue.toString());
        showToast(`Recalled: ${state.memoryValue}`);
        break;
      case 'mem-add':
        state.memoryValue += currentNum;
        showToast(`Memory +${currentNum} = ${state.memoryValue}`);
        break;
      case 'mem-sub':
        state.memoryValue -= currentNum;
        showToast(`Memory −${currentNum} = ${state.memoryValue}`);
        break;
      case 'mem-store':
        state.memoryValue = currentNum;
        showToast(`Stored ${currentNum} to Memory`);
        break;
    }

    // Update memory badge visibility
    if (state.memoryValue !== 0) {
      memoryBadge.classList.remove('hidden');
    } else {
      memoryBadge.classList.add('hidden');
    }
  }

  // ==========================================================================
  // History Management
  // ==========================================================================
  function loadHistory() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.HISTORY);
      if (stored) {
        state.history = JSON.parse(stored);
      }
    } catch {
      state.history = [];
    }
    renderHistory();
  }

  function saveHistory() {
    try {
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(state.history.slice(0, 50)));
    } catch {
      // LocalStorage space guard
    }
  }

  function addHistoryItem(exp, res) {
    const newItem = {
      id: Date.now().toString(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      expression: exp,
      result: res,
    };
    state.history.unshift(newItem);
    if (state.history.length > 50) state.history.pop();
    saveHistory();
    renderHistory();
  }

  function renderHistory() {
    historyCount.textContent = state.history.length;
    if (state.history.length > 0) {
      historyCount.classList.remove('hidden');
    } else {
      historyCount.classList.add('hidden');
    }

    if (state.history.length === 0) {
      historyList.innerHTML = `
        <div class="history-empty">
          <p>No calculations yet</p>
          <span>Calculations will appear here automatically</span>
        </div>`;
      return;
    }

    historyList.innerHTML = state.history
      .map(
        item => `
        <div class="history-item" data-id="${item.id}" data-exp="${escapeHtml(item.expression)}" data-res="${escapeHtml(item.result)}">
          <div class="history-meta">
            <span>Calculation</span>
            <span>${item.timestamp}</span>
          </div>
          <div class="history-item-exp">${escapeHtml(item.expression)}</div>
          <div class="history-item-res">= ${formatDisplayNumber(item.result)}</div>
        </div>`
      )
      .join('');
  }

  function toggleHistory(forceOpen) {
    const shouldOpen = forceOpen !== undefined ? forceOpen : !historyDrawer.classList.contains('open');
    if (shouldOpen) {
      historyDrawer.classList.add('open');
      drawerBackdrop.classList.remove('hidden');
    } else {
      historyDrawer.classList.remove('open');
      drawerBackdrop.classList.add('hidden');
    }
  }

  // ==========================================================================
  // Unit Converter Engine
  // ==========================================================================
  const CONVERTER_UNITS = {
    length: {
      label: 'Length',
      base: 'meter',
      units: {
        meter: { name: 'Meters (m)', factor: 1 },
        kilometer: { name: 'Kilometers (km)', factor: 1000 },
        centimeter: { name: 'Centimeters (cm)', factor: 0.01 },
        millimeter: { name: 'Millimeters (mm)', factor: 0.001 },
        mile: { name: 'Miles (mi)', factor: 1609.344 },
        yard: { name: 'Yards (yd)', factor: 0.9144 },
        foot: { name: 'Feet (ft)', factor: 0.3048 },
        inch: { name: 'Inches (in)', factor: 0.0254 },
      },
    },
    weight: {
      label: 'Weight & Mass',
      base: 'kilogram',
      units: {
        kilogram: { name: 'Kilograms (kg)', factor: 1 },
        gram: { name: 'Grams (g)', factor: 0.001 },
        milligram: { name: 'Milligrams (mg)', factor: 0.000001 },
        pound: { name: 'Pounds (lb)', factor: 0.45359237 },
        ounce: { name: 'Ounces (oz)', factor: 0.02834952 },
        tonne: { name: 'Metric Tonnes (t)', factor: 1000 },
      },
    },
    temperature: {
      label: 'Temperature',
      isCustom: true,
      units: {
        celsius: { name: 'Celsius (°C)' },
        fahrenheit: { name: 'Fahrenheit (°F)' },
        kelvin: { name: 'Kelvin (K)' },
      },
      convert: (val, from, to) => {
        if (from === to) return val;
        // Step 1: to Celsius
        let c = val;
        if (from === 'fahrenheit') c = (val - 32) * (5 / 9);
        else if (from === 'kelvin') c = val - 273.15;

        // Step 2: Celsius to target
        if (to === 'celsius') return c;
        if (to === 'fahrenheit') return (c * 9) / 5 + 32;
        if (to === 'kelvin') return c + 273.15;
        return c;
      },
    },
    digital: {
      label: 'Digital Storage',
      base: 'byte',
      units: {
        byte: { name: 'Bytes (B)', factor: 1 },
        kilobyte: { name: 'Kilobytes (KB)', factor: 1024 },
        megabyte: { name: 'Megabytes (MB)', factor: 1024 ** 2 },
        gigabyte: { name: 'Gigabytes (GB)', factor: 1024 ** 3 },
        terabyte: { name: 'Terabytes (TB)', factor: 1024 ** 4 },
      },
    },
    speed: {
      label: 'Speed',
      base: 'mps',
      units: {
        mps: { name: 'Meters/sec (m/s)', factor: 1 },
        kph: { name: 'Kilometers/hr (km/h)', factor: 0.277778 },
        mph: { name: 'Miles/hr (mph)', factor: 0.44704 },
        knot: { name: 'Knots (kn)', factor: 0.514444 },
      },
    },
  };

  let activeConverterCategory = 'length';

  function initConverter() {
    setupConverterCategory(activeConverterCategory);
  }

  function setupConverterCategory(categoryKey) {
    activeConverterCategory = categoryKey;
    const cat = CONVERTER_UNITS[categoryKey];

    // Populate dropdowns
    convFromUnit.innerHTML = '';
    convToUnit.innerHTML = '';

    const unitKeys = Object.keys(cat.units);
    unitKeys.forEach((key, index) => {
      const u = cat.units[key];
      const optFrom = new Option(u.name, key, false, index === 0);
      const optTo = new Option(u.name, key, false, index === 1 || (index === 0 && unitKeys.length === 1));
      convFromUnit.add(optFrom);
      convToUnit.add(optTo);
    });

    updateConversion();
  }

  function updateConversion() {
    const cat = CONVERTER_UNITS[activeConverterCategory];
    const val = parseFloat(convFromValue.value);
    const from = convFromUnit.value;
    const to = convToUnit.value;

    if (isNaN(val)) {
      convResultDisplay.textContent = '—';
      convFormula.textContent = '';
      return;
    }

    let result = 0;
    if (cat.isCustom) {
      result = cat.convert(val, from, to);
    } else {
      const baseValue = val * cat.units[from].factor;
      result = baseValue / cat.units[to].factor;
    }

    const cleaned = cleanPrecision(result);
    convResultDisplay.textContent = formatDisplayNumber(cleaned);

    // Formula helper
    convFormula.textContent = `1 ${cat.units[from].name.split(' ')[0]} = ${cleanPrecision(
      cat.isCustom ? cat.convert(1, from, to) : cat.units[from].factor / cat.units[to].factor
    )} ${cat.units[to].name.split(' ')[0]}`;
  }

  // ==========================================================================
  // Mode & Theme Switching
  // ==========================================================================
  function switchMode(newMode) {
    state.currentMode = newMode;
    [tabStandard, tabScientific, tabConverter].forEach(tab => {
      const isActive = tab.dataset.mode === newMode;
      tab.classList.toggle('active', isActive);
      tab.setAttribute('aria-selected', isActive.toString());
    });

    if (newMode === 'scientific') {
      app.classList.add('mode-scientific');
      mainKeypad.classList.remove('hidden');
      converterPanel.classList.add('hidden');
      engineModeBadge.textContent = 'SCI';
    } else if (newMode === 'converter') {
      app.classList.remove('mode-scientific');
      mainKeypad.classList.add('hidden');
      converterPanel.classList.remove('hidden');
      engineModeBadge.textContent = 'CONV';
      initConverter();
    } else {
      // Standard
      app.classList.remove('mode-scientific');
      mainKeypad.classList.remove('hidden');
      converterPanel.classList.add('hidden');
      engineModeBadge.textContent = 'STD';
    }
  }

  function toggleTheme() {
    const isDark = state.theme === 'dark';
    state.theme = isDark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', state.theme);
    localStorage.setItem(STORAGE_KEYS.THEME, state.theme);

    sunIcon.classList.toggle('hidden', state.theme === 'dark');
    moonIcon.classList.toggle('hidden', state.theme === 'light');
    showToast(`Switched to ${state.theme === 'dark' ? 'Midnight Nebula' : 'Pearl Aurora'}`);
  }

  function toggleSound() {
    state.soundEnabled = !state.soundEnabled;
    localStorage.setItem(STORAGE_KEYS.SOUND, state.soundEnabled.toString());
    soundOnIcon.classList.toggle('hidden', !state.soundEnabled);
    soundOffIcon.classList.toggle('hidden', state.soundEnabled);
    showToast(state.soundEnabled ? 'Sound FX Enabled' : 'Sound FX Muted');
  }

  function toggleAngleMode() {
    state.angleMode = state.angleMode === 'DEG' ? 'RAD' : 'DEG';
    localStorage.setItem(STORAGE_KEYS.ANGLE, state.angleMode);
    angleUnitBadge.textContent = state.angleMode;
    const btnDegRad = document.getElementById('btnDegRad');
    if (btnDegRad) btnDegRad.textContent = state.angleMode === 'DEG' ? 'Rad' : 'Deg';
    showToast(`Trigonometry mode: ${state.angleMode}`);
    updateDisplay();
  }

  // ==========================================================================
  // Event Listeners
  // ==========================================================================
  function setupEventListeners() {
    // Mode switcher pill tabs
    tabStandard.addEventListener('click', () => switchMode('standard'));
    tabScientific.addEventListener('click', () => switchMode('scientific'));
    tabConverter.addEventListener('click', () => switchMode('converter'));

    // Header actions
    themeToggle.addEventListener('click', toggleTheme);
    soundToggle.addEventListener('click', toggleSound);
    angleUnitBadge.addEventListener('click', toggleAngleMode);

    // Copy result
    copyResultBtn.addEventListener('click', () => {
      soundFx.tap();
      const textToCopy = state.lastResult;
      navigator.clipboard
        .writeText(textToCopy)
        .then(() => showToast(`Copied ${textToCopy} to clipboard!`))
        .catch(() => showToast('Failed to copy to clipboard'));
    });

    // Keypad event delegation
    mainKeypad.addEventListener('click', e => {
      const btn = e.target.closest('.calc-btn');
      if (!btn) return;

      const action = btn.dataset.action;
      const value = btn.dataset.value;

      switch (action) {
        case 'insert':
          handleInput(value);
          break;
        case 'calculate':
          handleCalculate();
          break;
        case 'clear-all':
          handleClearAll();
          break;
        case 'backspace':
          handleBackspace();
          break;
        case 'parentheses':
          handleParentheses();
          break;
        case 'negate':
          handleNegate();
          break;
        case 'deg-rad':
          toggleAngleMode();
          break;
        case 'mem-clear':
        case 'mem-recall':
        case 'mem-add':
        case 'mem-sub':
        case 'mem-store':
          handleMemory(action);
          break;
      }
    });

    // History drawer listeners
    historyToggle.addEventListener('click', () => toggleHistory());
    closeHistoryBtn.addEventListener('click', () => toggleHistory(false));
    drawerBackdrop.addEventListener('click', () => toggleHistory(false));
    clearHistoryBtn.addEventListener('click', () => {
      soundFx.clear();
      state.history = [];
      saveHistory();
      renderHistory();
      showToast('Calculation history cleared');
    });

    // Click on history item loads expression
    historyList.addEventListener('click', e => {
      const item = e.target.closest('.history-item');
      if (!item) return;

      soundFx.tap();
      state.expression = item.dataset.exp;
      state.lastResult = item.dataset.res;
      state.justCalculated = false;
      updateDisplay();
      toggleHistory(false);
      showToast('Loaded calculation from history');
    });

    // Converter events
    convCatButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        soundFx.tap();
        convCatButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        setupConverterCategory(btn.dataset.category);
      });
    });

    convFromValue.addEventListener('input', updateConversion);
    convFromUnit.addEventListener('change', updateConversion);
    convToUnit.addEventListener('change', updateConversion);

    convSwapBtn.addEventListener('click', () => {
      soundFx.tap();
      const temp = convFromUnit.value;
      convFromUnit.value = convToUnit.value;
      convToUnit.value = temp;
      updateConversion();
    });

    // Keyboard Shortcuts Modal
    keyboardHelpTrigger.addEventListener('click', () => {
      keyboardModal.classList.remove('hidden');
    });
    closeModalBtn.addEventListener('click', () => {
      keyboardModal.classList.add('hidden');
    });
    keyboardModal.addEventListener('click', e => {
      if (e.target === keyboardModal) keyboardModal.classList.add('hidden');
    });

    // Global Keyboard Listener
    window.addEventListener('keydown', handlePhysicalKeyboard);
  }

  function handlePhysicalKeyboard(e) {
    // If typing inside an input element (like the converter input), don't intercept standard numbers
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
      return;
    }

    const key = e.key;

    // Visual button press animation mapping
    let targetButton = null;

    if (/^[0-9]$/.test(key)) {
      handleInput(key);
      targetButton = document.querySelector(`.calc-btn[data-value="${key}"]`);
    } else if (key === '+' || key === '-') {
      handleInput(key === '-' ? '−' : '+');
      targetButton = document.querySelector(`.calc-btn[data-value="${key === '-' ? '−' : '+'}"]`);
    } else if (key === '*') {
      handleInput('×');
      targetButton = document.querySelector(`.calc-btn[data-value="×"]`);
    } else if (key === '/') {
      e.preventDefault();
      handleInput('÷');
      targetButton = document.querySelector(`.calc-btn[data-value="÷"]`);
    } else if (key === '.' || key === ',') {
      handleInput('.');
      targetButton = document.querySelector(`.calc-btn[data-value="."]`);
    } else if (key === '(' || key === ')') {
      handleInput(key);
      targetButton = document.querySelector(`.calc-btn[data-value="${key}"]`);
    } else if (key === '^') {
      handleInput('^');
      targetButton = document.querySelector(`.calc-btn[data-value="^"]`);
    } else if (key === '%') {
      handleInput('%');
      targetButton = document.querySelector(`.calc-btn[data-value="%"]`);
    } else if (key === 'Enter' || key === '=') {
      e.preventDefault();
      handleCalculate();
      targetButton = document.getElementById('btnEquals');
    } else if (key === 'Backspace') {
      e.preventDefault();
      handleBackspace();
      targetButton = document.getElementById('btnBackspace');
    } else if (key === 'Escape') {
      e.preventDefault();
      if (!keyboardModal.classList.contains('hidden')) {
        keyboardModal.classList.add('hidden');
      } else if (historyDrawer.classList.contains('open')) {
        toggleHistory(false);
      } else {
        handleClearAll();
        targetButton = document.getElementById('btnClear');
      }
    } else if (key.toLowerCase() === 'h' && !e.ctrlKey && !e.metaKey) {
      toggleHistory();
    } else if (key.toLowerCase() === 's' && !e.ctrlKey && !e.metaKey) {
      toggleSound();
    } else if (key.toLowerCase() === 'c' && !e.ctrlKey && !e.metaKey) {
      copyResultBtn.click();
    } else if (key === '?') {
      keyboardModal.classList.toggle('hidden');
    }

    // Trigger visual active feedback on on-screen button
    if (targetButton) {
      targetButton.classList.add('is-active');
      setTimeout(() => targetButton.classList.remove('is-active'), 140);
    }
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================
  function init() {
    // Restore saved settings
    const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME) || 'dark';
    state.theme = savedTheme;
    document.documentElement.setAttribute('data-theme', savedTheme);
    sunIcon.classList.toggle('hidden', savedTheme === 'dark');
    moonIcon.classList.toggle('hidden', savedTheme === 'light');

    const savedSound = localStorage.getItem(STORAGE_KEYS.SOUND);
    if (savedSound !== null) {
      state.soundEnabled = savedSound === 'true';
      soundOnIcon.classList.toggle('hidden', !state.soundEnabled);
      soundOffIcon.classList.toggle('hidden', state.soundEnabled);
    }

    const savedAngle = localStorage.getItem(STORAGE_KEYS.ANGLE);
    if (savedAngle) {
      state.angleMode = savedAngle;
      angleUnitBadge.textContent = savedAngle;
    }

    loadHistory();
    initConverter();
    setupEventListeners();
    updateDisplay();
  }

  // Start application on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
