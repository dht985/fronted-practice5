const state = { data: null };

const loadData = async () => {
  $('#status').text('加载中...').show();
  try {
    const response = await fetch('data/books.json');
    if (!response.ok) {
      throw new Error('HTTP ' + response.status);
    }
    const data = await response.json();
    if (data.series.length === 0) {
      $('#status').text('暂无数据').show();
      return;
    }
    state.data = data;
    $('#sub-title').text(data.title + ' · 数据来源：课程统一数据集');
    $('#status').hide();
    renderCards(data);
    renderBarChart(data);
    renderLineChart(data);
  } catch (error) {
    $('#status').text('加载失败：' + error.message).show();
  }
};

const renderCards = (data) => {
  const months = data.months;
  data.series.forEach(s => {
    const total = s.counts.reduce((sum, n) => sum + n, 0);
    $('#cards').append(`
      <div class="col-md-4">
        <div class="card">
          <div class="card-body">
            <h3 class="card-title h6">${s.category}</h3>
            <p class="card-text fs-4">${total}</p>
            <p class="card-text small text-muted">共${months.length}个月累计借阅</p>
          </div>
        </div>
      </div>
    `);
  });
};

// 两张图表共用同一套分类配色，联动时视觉口径一致
const CATEGORY_COLORS = {
  '文学': '#4e79a7',
  '科技': '#f28e2b',
  '历史': '#59a14f'
};

// 当前联动高亮的分类名；null 表示无联动
let linkedCategory = null;

let barChart = null;

const renderBarChart = (data) => {
  if (barChart === null) {
    barChart = echarts.init(document.querySelector('#bar-chart'));
    // ECharts 事件绑定：query 限定为 'series'，只有点中柱子才回调
    // params.seriesName 即被点柱子的分类名
    barChart.on('click', 'series', (params) => {
      toggleLink(params.seriesName);
    });
  }
  barChart.setOption({
    color: data.series.map(s => CATEGORY_COLORS[s.category]),
    title: { text: '各月各品类借阅量', left: 'center' },
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0 },
    xAxis: { data: data.months },
    yAxis: { name: '册' },
    series: data.series.map(s => ({
      name: s.category,
      type: 'bar',
      data: s.counts,
      emphasis: { focus: 'series' }   // 高亮某系列时自动淡化其他柱子
    }))
  });
};

let lineChart = null;

const renderLineChart = (data) => {
  if (lineChart !== null) {
    lineChart.destroy();               // 防重复初始化
  }
  const ctx = document.querySelector('#line-chart');
  lineChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.months,
      datasets: data.series.map(s => {
        const color = CATEGORY_COLORS[s.category];
        return {
          label: s.category,
          data: s.counts,
          borderColor: color,
          backgroundColor: color,
          pointBackgroundColor: color,
          pointBorderColor: color,
          borderWidth: 1,
          pointRadius: 3,
          // 记住“普通态”样式，联动取消时按它还原
          _base: { color: color, borderWidth: 1, pointRadius: 3 }
        };
      })
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      // Chart.js 事件：点中数据点时，elements 携带 datasetIndex，据此取分类名
      onClick: (event, elements, chart) => {
        if (elements.length > 0) {
          const dsIndex = elements[0].datasetIndex;
          toggleLink(chart.data.datasets[dsIndex].label);
        }
      },
      plugins: {
        title: { display: true, text: '借阅趋势（单位：册）' }
      }
    }
  });
};

// #rrggbb 转 rgba，便于把非高亮线条改成半透明淡化色
const withAlpha = (hex, alpha) => {
  const n = parseInt(hex.slice(1), 16);
  return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ','
    + (n & 255) + ',' + alpha + ')';
};

// ECharts 侧：highlight 选中系列、downplay 其余系列（程序化触发 emphasis）
const applyBarLink = () => {
  if (barChart === null) return;
  const series = barChart.getOption().series;
  series.forEach((s, i) => {
    barChart.dispatchAction({ type: 'downplay', seriesIndex: i });
  });
  if (linkedCategory !== null) {
    const idx = series.findIndex(s => s.name === linkedCategory);
    if (idx >= 0) {
      barChart.dispatchAction({ type: 'highlight', seriesIndex: idx });
    }
  }
};

// Chart.js 侧：选中线加粗加大点，其余线改为 15% 透明度
const applyLineLink = () => {
  if (lineChart === null) return;
  lineChart.data.datasets.forEach(ds => {
    const base = ds._base;
    const active = ds.label === linkedCategory;
    const dimmed = linkedCategory !== null && !active;
    const color = dimmed ? withAlpha(base.color, 0.15) : base.color;
    ds.borderColor = color;
    ds.backgroundColor = color;
    ds.pointBackgroundColor = color;
    ds.pointBorderColor = color;
    ds.borderWidth = active ? 3 : base.borderWidth;
    ds.pointRadius = active ? 6 : (dimmed ? 2 : base.pointRadius);
  });
  lineChart.update('none');   // 'none' 跳过动画，联动即时生效
};

const syncLinkHint = () => {
  $('#link-hint').text(linkedCategory === null
    ? '联动提示：点击柱状图的柱子或折线图上的数据点，可高亮对应分类；再次点击取消。'
    : '已联动高亮：【' + linkedCategory
      + '】——两张图表中该分类加粗显示，其余分类已淡化，再次点击取消。'
  );
};

// 联动总开关：同名再点一次即取消
const toggleLink = (name) => {
  linkedCategory = linkedCategory === name ? null : name;
  applyBarLink();
  applyLineLink();
  syncLinkHint();
};

window.addEventListener('resize', () => {
  if (barChart) barChart.resize();
  // Chart.js响应式默认自动处理，无需手动
});

// 卡片点击高亮：事件委托绑在静态父容器 #cards 上，动态生成的卡片也能响应
$('#cards').on('click', '.card', function () {    // 事件委托：jQuery内置写法
  $(this).toggleClass('border-primary shadow');
});

loadData();
