/* ============================================================
   Penny Pilot — Premium Chart.js Defaults
   Modern donut + gradient area styling. Loaded BEFORE page chart code.
   ============================================================ */
(function () {
    if (typeof window === 'undefined' || typeof window.Chart === 'undefined') return;

    const Chart = window.Chart;

    // Vibrant chart palette — the ONLY place color lives in the UI.
    // Refined Tailwind-inspired tones; balanced, distinguishable, premium.
    const palette = {
        primary:  '#6366F1',  // indigo
        success:  '#10B981',  // emerald
        purple:   '#8B5CF6',  // violet
        warning:  '#F59E0B',  // amber
        danger:   '#EF4444',  // rose
        info:     '#06B6D4',  // cyan
        pink:     '#EC4899',  // pink
        teal:     '#14B8A6',  // teal
        lime:     '#84CC16',  // lime
        orange:   '#F97316',  // orange
        text:     '#0A0A0A',
        muted:    '#737373',
        grid:     'rgba(10, 10, 10, 0.06)',
    };

    // Ordered palette used to color datasets/segments by default.
    const seriesColors = [
        palette.primary,
        palette.success,
        palette.warning,
        palette.purple,
        palette.danger,
        palette.info,
        palette.pink,
        palette.teal,
        palette.lime,
        palette.orange,
    ];

    // Globals
    Chart.defaults.font.family = "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif";
    Chart.defaults.font.size = 13;
    Chart.defaults.color = palette.muted;
    Chart.defaults.borderColor = palette.grid;
    Chart.defaults.scale = Chart.defaults.scale || {};
    if (Chart.defaults.scales) {
        ['linear', 'category', 'time', 'logarithmic'].forEach(s => {
            if (Chart.defaults.scales[s]) {
                Chart.defaults.scales[s].grid = Chart.defaults.scales[s].grid || {};
                Chart.defaults.scales[s].grid.color = palette.grid;
                Chart.defaults.scales[s].grid.borderColor = palette.grid;
                Chart.defaults.scales[s].grid.tickColor = palette.grid;
                Chart.defaults.scales[s].ticks = Chart.defaults.scales[s].ticks || {};
                Chart.defaults.scales[s].ticks.color = palette.muted;
            }
        });
    }

    // Plugins — legends + tooltips
    if (Chart.defaults.plugins) {
        Chart.defaults.plugins.legend = Chart.defaults.plugins.legend || {};
        Chart.defaults.plugins.legend.position = 'bottom';
        Chart.defaults.plugins.legend.labels = Object.assign(
            {},
            Chart.defaults.plugins.legend.labels,
            {
                usePointStyle: true,
                pointStyle: 'circle',
                padding: 18,
                color: palette.text,
                boxWidth: 8,
                boxHeight: 8,
                font: { size: 12.5, weight: '600' },
            }
        );
        Chart.defaults.plugins.tooltip = Chart.defaults.plugins.tooltip || {};
        Object.assign(Chart.defaults.plugins.tooltip, {
            backgroundColor: 'rgba(10, 10, 10, 0.94)',
            titleColor: '#FFFFFF',
            bodyColor: '#E5E5E5',
            borderColor: 'rgba(255,255,255,0.08)',
            borderWidth: 1,
            padding: 11,
            cornerRadius: 10,
            displayColors: true,
            boxPadding: 6,
            usePointStyle: true,
            titleFont: { size: 12, weight: '700' },
            bodyFont: { size: 12, weight: '500' },
            caretPadding: 8,
        });
    }

    // Element defaults
    if (Chart.defaults.elements) {
        // Smoother lines + soft gradient hint via line tension
        if (Chart.defaults.elements.line) {
            Chart.defaults.elements.line.tension = 0.4;
            Chart.defaults.elements.line.borderWidth = 2.5;
            Chart.defaults.elements.line.borderJoinStyle = 'round';
            Chart.defaults.elements.line.borderCapStyle = 'round';
            Chart.defaults.elements.line.fill = true;
        }
        if (Chart.defaults.elements.point) {
            Chart.defaults.elements.point.radius = 0;
            Chart.defaults.elements.point.hoverRadius = 5;
            Chart.defaults.elements.point.hitRadius = 18;
            Chart.defaults.elements.point.borderWidth = 2;
            Chart.defaults.elements.point.hoverBorderWidth = 3;
            Chart.defaults.elements.point.backgroundColor = '#FFFFFF';
        }
        if (Chart.defaults.elements.arc) {
            Chart.defaults.elements.arc.borderWidth = 0;
            Chart.defaults.elements.arc.borderRadius = 4;
            Chart.defaults.elements.arc.spacing = 1.5;
        }
        if (Chart.defaults.elements.bar) {
            Chart.defaults.elements.bar.borderRadius = 8;
            Chart.defaults.elements.bar.borderSkipped = false;
            Chart.defaults.elements.bar.borderWidth = 0;
        }
    }

    // Smooth animation
    Chart.defaults.animation = Object.assign({}, Chart.defaults.animation || {}, {
        duration: 800,
        easing: 'easeOutQuart',
    });
    Chart.defaults.animations = Object.assign({}, Chart.defaults.animations || {}, {
        colors: { duration: 600, easing: 'easeOutQuart' },
        numbers: { duration: 800, easing: 'easeOutQuart' },
    });

    // Helper: hex -> rgba
    function hexToRgba(hex, alpha) {
        const h = hex.replace('#', '');
        const r = parseInt(h.substring(0, 2), 16);
        const g = parseInt(h.substring(2, 4), 16);
        const b = parseInt(h.substring(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    // Plugin: build a vertical gradient fill for line/area datasets
    const gradientFillPlugin = {
        id: 'pp_gradient_fill',
        beforeDatasetsDraw(chart) {
            const { ctx, chartArea } = chart;
            if (!chartArea) return;
            chart.data.datasets.forEach((ds, i) => {
                if (ds._ppGradientApplied) return;
                if (ds.type && ds.type !== 'line') return;
                if (chart.config.type !== 'line' && !ds.type) return;

                const color = (typeof ds.borderColor === 'string' && ds.borderColor) || seriesColors[i % seriesColors.length];
                if (typeof color !== 'string' || !color.startsWith('#')) return;

                const grad = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                grad.addColorStop(0, hexToRgba(color, 0.32));
                grad.addColorStop(1, hexToRgba(color, 0));
                ds.backgroundColor = grad;
                ds._ppGradientApplied = true;
            });
        },
    };
    Chart.register(gradientFillPlugin);

    // Auto-tweak: when a chart is created, polish doughnut / pie / line / bar visuals.
    const originalControllerInit = Chart.prototype.update;
    Chart.register({
        id: 'pp_premium_polish',
        beforeInit(chart) {
            const cfg = chart.config;
            const type = cfg.type;

            // Convert any pie chart into a donut for a modern look (cutout 65%)
            if (type === 'pie' || type === 'doughnut') {
                cfg.options = cfg.options || {};
                if (typeof cfg.options.cutout === 'undefined') {
                    cfg.options.cutout = '68%';
                }
                cfg.options.borderRadius = typeof cfg.options.borderRadius === 'number'
                    ? cfg.options.borderRadius
                    : 6;
                cfg.options.spacing = typeof cfg.options.spacing === 'number'
                    ? cfg.options.spacing
                    : 2;

                // Apply branded palette if dataset uses default colors
                (cfg.data && cfg.data.datasets || []).forEach((ds) => {
                    if (!ds.backgroundColor || (Array.isArray(ds.backgroundColor) && ds.backgroundColor.length === 0)) {
                        ds.backgroundColor = seriesColors.slice(0, (ds.data || []).length);
                    }
                    if (!ds.borderColor) ds.borderColor = '#FFFFFF';
                    if (typeof ds.borderWidth === 'undefined') ds.borderWidth = 2;
                    if (typeof ds.hoverOffset === 'undefined') ds.hoverOffset = 8;
                });
            }

            // Bar charts: rounded + branded palette if missing
            if (type === 'bar') {
                (cfg.data && cfg.data.datasets || []).forEach((ds, i) => {
                    if (!ds.backgroundColor) {
                        ds.backgroundColor = seriesColors[i % seriesColors.length];
                    }
                    if (typeof ds.borderRadius === 'undefined') ds.borderRadius = 8;
                    if (typeof ds.maxBarThickness === 'undefined') ds.maxBarThickness = 36;
                });
            }

            // Line charts: smooth + filled with subtle gradient
            if (type === 'line') {
                (cfg.data && cfg.data.datasets || []).forEach((ds, i) => {
                    if (!ds.borderColor) ds.borderColor = seriesColors[i % seriesColors.length];
                    if (typeof ds.tension === 'undefined') ds.tension = 0.4;
                    if (typeof ds.fill === 'undefined') ds.fill = true;
                    if (typeof ds.pointRadius === 'undefined') ds.pointRadius = 0;
                    if (typeof ds.pointHoverRadius === 'undefined') ds.pointHoverRadius = 5;
                });
            }

            // Common: ensure responsive + maintainAspectRatio off for fluid containers
            cfg.options = cfg.options || {};
            if (typeof cfg.options.responsive === 'undefined') cfg.options.responsive = true;
            if (typeof cfg.options.maintainAspectRatio === 'undefined') cfg.options.maintainAspectRatio = false;
        },
    });

    // Expose palette for any page that wants it
    window.PennyPilotChartTheme = { palette, seriesColors, hexToRgba };
})();
