"use client";

import { useState, useEffect } from "react";

interface Habit {
  id: string;
  name: string;
  completedDates: string[];
}

export default function Home() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [newHabitName, setNewHabitName] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("habits");
    if (stored) {
      setHabits(JSON.parse(stored));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("habits", JSON.stringify(habits));
  }, [habits]);

  const addHabit = () => {
    if (!newHabitName.trim()) return;
    const newHabit: Habit = {
      id: crypto.randomUUID(),
      name: newHabitName.trim(),
      completedDates: [],
    };
    setHabits([...habits, newHabit]);
    setNewHabitName("");
  };

  const deleteHabit = (id: string) => {
    setHabits(habits.filter((h) => h.id !== id));
  };

  const toggleToday = (id: string) => {
    const today = new Date().toISOString().split("T")[0];
    setHabits(
      habits.map((h) => {
        if (h.id !== id) return h;
        const completed = h.completedDates.includes(today);
        return {
          ...h,
          completedDates: completed
            ? h.completedDates.filter((d) => d !== today)
            : [...h.completedDates, today],
        };
      })
    );
  };

  const today = new Date().toISOString().split("T")[0];

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Habit Tracker</h1>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Add New Habit</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={newHabitName}
              onChange={(e) => setNewHabitName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addHabit()}
              placeholder="e.g., Drink 8 glasses of water"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={addHabit}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Add
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {habits.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No habits yet. Add your first habit above!
            </p>
          ) : (
            habits.map((habit) => {
              const isCompletedToday = habit.completedDates.includes(today);
              const streak = calculateStreak(habit.completedDates);

              return (
                <div
                  key={habit.id}
                  className="bg-white rounded-lg shadow p-6"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {habit.name}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">
                        {streak > 0
                          ? `🔥 ${streak} day streak`
                          : "Start your streak today!"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => toggleToday(habit.id)}
                        className={`px-4 py-2 rounded-lg transition ${
                          isCompletedToday
                            ? "bg-green-600 text-white"
                            : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                        }`}
                      >
                        {isCompletedToday ? "✓ Done" : "Mark Done"}
                      </button>
                      <button
                        onClick={() => deleteHabit(habit.id)}
                        className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  {habit.completedDates.length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-xs text-gray-500">
                        {habit.completedDates.length} total completions
                      </p>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </main>
  );
}

function calculateStreak(completedDates: string[]): number {
  if (completedDates.length === 0) return 0;

  const sorted = [...completedDates].sort().reverse();
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000)
    .toISOString()
    .split("T")[0];

  let streak = 0;
  let checkDate = sorted[0] === today ? new Date() : new Date(Date.now() - 86400000);

  for (let i = 0; i < sorted.length; i++) {
    const expected = checkDate.toISOString().split("T")[0];
    if (sorted[i] === expected) {
      streak++;
      checkDate = new Date(checkDate.getTime() - 86400000);
    } else if (i === 0 && sorted[i] === yesterday && sorted[0] !== today) {
      streak++;
      checkDate = new Date(checkDate.getTime() - 86400000);
    } else {
      break;
    }
  }

  return streak;
}
