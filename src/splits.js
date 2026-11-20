/**
 * splits.js — predefined workout split presets
 */

export const SPLIT_PRESETS = [
  {
    key: "arnold",
    name: "Arnold Split",
    description: "Chest & Back · Shoulders & Arms · Legs",
    days: [
      { name: "Chest & Back" },
      { name: "Shoulders & Arms" },
      { name: "Legs" },
    ],
  },
  {
    key: "ppl",
    name: "Push Pull Legs",
    description: "Push · Pull · Legs",
    days: [
      { name: "Push" },
      { name: "Pull" },
      { name: "Legs" },
    ],
  },
  {
    key: "upper-lower",
    name: "Upper / Lower",
    description: "Upper Body · Lower Body",
    days: [
      { name: "Upper Body" },
      { name: "Lower Body" },
    ],
  },
  {
    key: "ant-post",
    name: "Anterior / Posterior",
    description: "Anterior · Posterior",
    days: [
      { name: "Anterior" },
      { name: "Posterior" },
    ],
  },
  {
    key: "custom",
    name: "Custom Split",
    description: "Create your own workout days",
    days: [{ name: "Day 1" }],
  },
];

/** A small optional starter set used during onboarding */
export const SAMPLE_EXERCISES = [
  { name: "Flat Barbell Bench Press", sets: 3, repMin: 8, repMax: 12, weight: 20, increment: 2.5 },
  { name: "Incline Dumbbell Press", sets: 3, repMin: 8, repMax: 12, weight: 16, increment: 2 },
  { name: "Lat Pulldown", sets: 3, repMin: 8, repMax: 12, weight: 30, increment: 2.5 },
  { name: "Seated Cable Row", sets: 3, repMin: 8, repMax: 12, weight: 35, increment: 2.5 },
];
