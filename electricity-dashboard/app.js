/* 美国电力供应数据看板：fetch 加载本地 JSON，处理加载中/失败/空数据三种状态 */

// 演示用数据文件映射（broken 指向不存在的文件以触发 404）
const DATA_FILES = {
  normal: 'data/electricity.json',
  empty: 'data/electricity-empty.json',
  broken: 'data/not-exist.json'
};

// 本地 fetch 很快，加一个短延时让“加载中”状态在课堂演示时肉眼可见
const LOAD_DELAY = 600;

// 各电源统一配色（两张图表共用，保证视觉口径一致）
const COLORS = {
  '煤炭': '#596275',
  '天然气': '#e07b39',
  '核电': '#4a6fa5',
  '水电': '#3fa796',
  '风电': '#7fae6d',
  '太阳能': '#e8b84b'
};

const state = { data: null };

let barChart = null;

const $status = $('#status');
const $cards = $('#cards');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 统一状态提示：type 取 loading / error / empty
const showStatus = (type, html) => {
  $status.removeClass('alert-info alert-danger alert-secondary').show();
  if (type === 'loading') {
    $status.addClass('alert-info').html(
      '<span class="spinner-border spinner-border-sm me-2"></span>' + html
    );
  } else if (type === 'error') {
    $status.addClass('alert-danger').html(html);
  } else {
    $status.addClass('alert-secondary').html(html);
  }
};

const hideStatus = () => $status.hide();

// 加载数据
const loadData = async (key = 'normal') => {
  showStatus('loading', '数据加载中，请稍候…');
  try {
    await sleep(LOAD_DELAY);
    const response = await fetch(DATA_FILES[key]);
    if (!response.ok) {
      throw new Error('HTTP ' + response.status);
    }
    const data = await response.json();

    // 空数据状态
    if (!Array.isArray(data.series) || data.series.length === 0) {
      state.data = null;
      $cards.empty();
      disposeCharts();
      showStatus('empty', '暂无数据：该数据集没有可展示的发电量记录。');
      return;
    }

    state.data = data;
    $('#sub-title').text(data.title + ' · 数据来源：' + data.source);
    hideStatus();
    renderCards(data);
    renderBarChart(data);
  } catch (error) {
    // 加载失败状态（断网、404、JSON 解析错误都会进入这里）
    state.data = null;
    $cards.empty();
    disposeCharts();
    showStatus('error',
      '数据加载失败：<strong>' + error.message + '</strong>。<br>'
      + '请检查网络或本地服务是否正常（需通过 http:// 而非 file:// 访问）。'
    );
  }
};

// 统计卡片：以最新年份（数组最后一年）为口径
const renderCards = (data) => {
  const last = data.years.length - 1;
  const latestYear = data.years[last];

  let total = 0;
  let renewable = 0;
  let top = { name: '-', value: 0 };
  data.series.forEach(s => {
    total += s.data[last];
    if (s.name === '水电' || s.name === '风电' || s.name === '太阳能') {
      renewable += s.data[last];
    }
    if (s.data[last] > top.value) {
      top = { name: s.name, value: s.data[last] };
    }
  });
  const renewableShare = Math.round(renewable / total * 100);
  const topShare = Math.round(top.value / total * 100);
  const solarFirst = data.series.find(s => s.name === '太阳能').data[0];
  const solarLast = data.series.find(s => s.name === '太阳能').data[last];
  const solarGrowth = (solarLast / solarFirst).toFixed(1);

  const cards = [
    { label: latestYear + '年总发电量', value: total.toLocaleString(), unit: 'TWh', note: '六类电源净发电量合计' },
    { label: '可再生能源占比', value: renewableShare, unit: '%', note: '水电 + 风电 + 太阳能' },
    { label: '第一大电源：' + top.name, value: topShare, unit: '%', note: '占总发电量比重' },
    { label: '太阳能十年增长', value: solarGrowth, unit: '倍', note: solarFirst + ' → ' + solarLast + ' TWh' }
  ];

  $cards.html(cards.map(c => `
    <div class="col-md-6 col-lg-3">
      <div class="card stat-card h-100">
        <div class="card-body">
          <h3 class="card-title h6 text-muted">${c.label}</h3>
          <p class="card-text fs-3 fw-bold mb-1">${c.value}<span class="fs-6 fw-normal text-muted ms-1">${c.unit}</span></p>
          <p class="card-text small text-muted mb-0">${c.note}</p>
        </div>
      </div>
    </div>
  `).join(''));
};

// 空数据/失败时销毁已有图表实例，避免残留旧图形
const disposeCharts = () => {
  if (barChart !== null) {
    barChart.dispose();
    barChart = null;
  }
};

// ECharts 堆叠柱状图：同时表达每年发电总量与电源构成
const renderBarChart = (data) => {
  if (barChart === null) {
    barChart = echarts.init(document.querySelector('#bar-chart'));
  }
  barChart.setOption({
    color: data.series.map(s => COLORS[s.name]),
    title: {
      text: '美国发电量结构',
      subtext: '单位：' + data.unit + '｜数据来源：' + data.source,
      left: 'center'
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      valueFormatter: v => v + ' TWh'
    },
    legend: { bottom: 0, type: 'scroll' },
    grid: { left: 50, right: 20, top: 70, bottom: 50 },
    xAxis: { type: 'category', data: data.years },
    yAxis: { type: 'value', name: data.unit },
    series: data.series.map(s => ({
      name: s.name,
      type: 'bar',
      stack: 'total',
      emphasis: { focus: 'series' },
      data: s.data
    }))
  });
};

// 状态演示按钮（事件委托）
$('.demo-bar').on('click', 'button[data-demo]', function () {
  loadData($(this).data('demo'));
});

loadData();
