"use client";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

export default function IpChart() {
  const data = {
    labels: ['10.18.22.x', '10.18.23.x', '10.18.24.x', '10.18.25.x', '10.18.26.x'],
    datasets: [
      {
        data: [85, 62, 45, 30, 15],
        backgroundColor: ['#007aff', '#5856d6', '#34c759', '#ff9500', '#ff3b30'],
        borderRadius: 8,
        barThickness: 30,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: { beginAtZero: true, max: 100, ticks: { font: { size: 10, weight: 700 } }, grid: { display: false } },
      x: { ticks: { font: { size: 10, weight: 700 } }, grid: { display: false } },
    },
  };

  return <Bar data={data} options={options} />;
}