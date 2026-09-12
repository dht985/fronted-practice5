/* 图书馆数据看板：fetch 加载 JSON 数据，渲染统计卡片、ECharts 柱状图 */

const DATA_URL = 'data/books.json';

const statusEl = document.getElementById('status');
const titleEl = document.getElementById('dashboard-title');
const subtitleEl = document.getElementById('dashboard-subtitle');
const statsSectionEl = document.getElementById('stats-section');
const barSectionEl = document.getElementById('bar-section');

let barChart = null;

// 加载数据
async function loadData() {
  try {
    const response = await fetch(DATA_URL);
    if (!response.ok) {
      throw new Error('服务器响应状态码：' + response.status);
    }
    const data = await response.json();
    render(data);
  } catch (err) {
    showError(err);
  }
}

// 数据加载失败时给出可读提示（file:// 协议下 fetch 会被浏览器拦截）
function showError(err) {
  console.error('数据加载失败：', err);
  let tip = '';
  if (location.protocol === 'file:') {
    tip = '<br><br>当前为 <code>file://</code> 直接打开方式，浏览器会拦截本地 JSON 读取。<br>请在 dashboard 目录下运行本地服务，例如：<code>python -m http.server 8000</code>，然后访问 <code>http://localhost:8000/</code>';
  }
  statusEl.className = 'status error';
  statusEl.innerHTML = '数据加载失败：' + err.message + tip;
}

// 根据原始数据计算统计指标
function calcStats(data) {
  const monthCount = data.months.length;
  let total = 0;
  data.series.forEach(function (item) {
    item.counts.forEach(function (n) {
      total += n;
    });
  });
  return [
    { label: '总借阅量', value: total, unit: '册' },
    { label: '图书分类', value: data.series.length, unit: '类' },
    { label: '统计月份', value: monthCount, unit: '个月' },
    { label: '月均借阅', value: Math.round(total / monthCount), unit: '册' }
  ];
}

// 渲染统计卡片
function renderStats(stats) {
  const html = stats.map(function (s) {
    return '<div class="stat-card">'
      + '<div class="label">' + s.label + '</div>'
      + '<div class="value">' + s.value + '<span class="unit">' + s.unit + '</span></div>'
      + '</div>';
  }).join('');
  statsSectionEl.innerHTML = html;
}

// 使用 ECharts 渲染各类别月度借阅量柱状图
function renderBarChart(data) {
  if (!barChart) {
    barChart = echarts.init(document.getElementById('bar-chart'));
  }
  const option = {
    color: ['#4a6fa5', '#7fae6d', '#e0a458'],
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' }
    },
    legend: {
      top: 0,
      data: data.series.map(function (s) { return s.category; })
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: 48,
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: data.months
    },
    yAxis: {
      type: 'value',
      name: '借阅量（册）'
    },
    series: data.series.map(function (s) {
      return {
        name: s.category,
        type: 'bar',
        data: s.counts,
        barMaxWidth: 36
      };
    })
  };
  barChart.setOption(option);
  barSectionEl.hidden = false;
}

// 窗口尺寸变化时让图表自适应
window.addEventListener('resize', function () {
  if (barChart) {
    barChart.resize();
  }
});

// 整体渲染
function render(data) {
  console.log('加载到的数据：', data);
  titleEl.textContent = data.title;
  subtitleEl.textContent = '共 ' + data.months.length + ' 个月 · ' + data.series.length + ' 个图书分类';
  renderStats(calcStats(data));
  renderBarChart(data);
  statusEl.hidden = true;
  statsSectionEl.hidden = false;
}

loadData();
