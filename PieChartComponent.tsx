import React from 'react';
import { Pie } from 'react-chartjs-2';
import { ChartData, ChartOptions, Plugin, ScriptableChartContext } from 'chart.js'; // Added Plugin for type safety
import { LIGHT_THEME_CHART_COLORS } from './constants';

// Chart.js instance and modules like ArcElement, Tooltip, Legend, Title
// should be registered globally, typically in App.tsx or the main entry point.

interface PieChartProps {
  data: ChartData<'pie', number[], string>;
  options?: ChartOptions<'pie'>;
  titleText?: string;
}

const PieChartComponent: React.FC<PieChartProps> = ({ data, options, titleText }) => {
  const defaultPlugins: Plugin<'pie'>[] = [
    {
      id: 'customHoverBackgroundColor', // Optional: if you want to change bg on hover further
      afterDraw: chart => {
        // You could add custom drawing here if needed
      }
    }
  ];

  const defaultOptions: ChartOptions<'pie'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          color: '#4b5563', // gray-600 for text on light bg
          font: {
            size: 11,
            family: 'Inter, sans-serif'
          },
          padding: 15,
          boxWidth: 12,
          usePointStyle: true,
        },
      },
      title: {
        display: !!titleText,
        text: titleText,
        color: '#1f2937', // gray-800
        font: {
            size: 16,
            weight: 600, // Corrected: Use number or valid string literal like 'bold'
            family: 'Inter, sans-serif'
        },
        padding: {
            top: 0,
            bottom: 10
        }
      },
      tooltip: {
        enabled: true,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        titleColor: '#1f2937',
        bodyColor: '#374151',
        borderColor: '#d1d5db',
        borderWidth: 1,
        padding: 10,
        cornerRadius: 4,
        titleFont: {
            size: 13,
            weight: 'bold'  as const,
            family: 'Inter, sans-serif'
        },
        bodyFont: {
            size: 12,
            family: 'Inter, sans-serif'
        },
        callbacks: {
          label: function(context) {
            let label = context.label || '';
            let value = context.parsed;
            // Attempt to get the original full label if it was split for the legend
            const originalLabel = context.chart.data.labels?.[context.dataIndex];
            
            if (typeof originalLabel === 'string') { // Type check for originalLabel
              // Extract name before parenthesis if pattern matches "Name (Percentage%)"
              const match = originalLabel.match(/^(.*)\s*\([\d.]+%\)$/);
              label = match ? match[1].trim() : originalLabel.split('(')[0].trim();
            } else if (label) {
                // Fallback to context.label if originalLabel is not a string
                const match = label.match(/^(.*)\s*\([\d.]+%\)$/);
                label = match ? match[1].trim() : label.split('(')[0].trim();
            }


            if (value !== null && typeof value === 'number') {
              return `${label}: ${value.toFixed(2)}%`;
            }
            return '';
          }
        }
      }
    },
    animation: {
        duration: 400,
        easing: 'easeOutQuart'
    },
  };

  // Prepare a mutable copy of the input data to apply styling
  const styledData = JSON.parse(JSON.stringify(data)) as ChartData<'pie', number[], string>;

  if (styledData.datasets && styledData.datasets.length > 0) {
    styledData.datasets.forEach(dataset => {
      // Ensure backgroundColor is an array and apply distinct colors
      dataset.backgroundColor = (styledData.labels || []).map(
        (_, i) => LIGHT_THEME_CHART_COLORS[i % LIGHT_THEME_CHART_COLORS.length]
      );
      dataset.borderColor = '#ffffff'; // white border for segments
      dataset.borderWidth = 2;
    });
  }
  
  // Deep merge options, ensuring plugins are handled correctly
  const mergedOptions = { 
    ...defaultOptions, 
    ...options,
    plugins: {
      ...defaultOptions.plugins,
      ...options?.plugins,
    }
  };


  return <Pie data={styledData} options={mergedOptions} />;
};

export default PieChartComponent;