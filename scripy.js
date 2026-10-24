
const $ = (id) => document.getElementById(id);

const STORAGE_KEY = "lazymate_tasks_v1";
let tasks = [];

try {
  tasks = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  if (!Array.isArray(tasks)) tasks = [];
} catch {
  tasks = [];
}

let timerSeconds = 600;
let timerInterval = null;
let timerRunning = false;
let toastTimeout;

function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch {}
}

function showToast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => el.classList.remove("show"), 2300);
}

function switchView(id) {
  document.querySelectorAll(".view").forEach(v =>
    v.classList.toggle("active-view", v.id === id)
  );

  document.querySelectorAll(".nav-item").forEach(b =>
    b.classList.toggle("active", b.dataset.view === id)
  );

  const active = document.querySelector(
    `.nav-item[data-view="${id}"]`
  );

  $("crumb").textContent = active
    ? active.textContent.trim()
    : ({
        overview: "Overview",
        tasks: "Task organizer",
        summarizer: "Text summarizer",
        planner: "Easy-day planner"
      }[id] || "Overview");

  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll("[data-view]").forEach(button => {
  button.addEventListener("click", () =>
    switchView(button.dataset.view)
  );
});

document.querySelectorAll("[data-go]").forEach(button => {
  button.addEventListener("click", () =>
    switchView(button.dataset.go)
  );
});

// TASK ORGANIZER

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[character]));
}

function taskMarkup(task) {
  return `
    <div class="task-row ${task.done ? "completed" : ""}">
      <input
        class="task-check"
        type="checkbox"
        aria-label="Complete ${escapeHTML(task.title)}"
        data-check="${task.id}"
        ${task.done ? "checked" : ""}
      >
      <span class="task-title">${escapeHTML(task.title)}</span>
      <span class="priority ${task.priority}">
        ${task.priority}
      </span>
      <button
        class="delete-task"
        aria-label="Delete task"
        data-delete="${task.id}"
      >×</button>
    </div>
  `;
}

function renderTasks() {
  const filter = $("taskFilter")?.value || "all";

  const filtered = tasks.filter(task =>
    filter === "all" ||
    (filter === "active" && !task.done) ||
    (filter === "done" && task.done)
  );

  $("taskList").innerHTML = filtered.length
    ? filtered.map(taskMarkup).join("")
    : `<div class="empty-state">${
        filter === "done"
          ? "No completed tasks yet. Your wins will show up here."
          : filter === "active"
          ? "You're all caught up. Enjoy the breathing room."
          : "Your list is clear. Add a task above when you're ready."
      }</div>`;

  $("overviewTasks").innerHTML = tasks.length
    ? tasks.slice(0, 4).map(taskMarkup).join("")
    : "No tasks yet. Add one small thing to get started.";

  $("totalStat").textContent = tasks.length;
  $("doneStat").textContent = tasks.filter(t => t.done).length;

  $("doneCaption").textContent =
    tasks.length && tasks.every(t => t.done)
      ? "You did it — list complete!"
      : "Every little win counts";

  $("taskCount").textContent =
    `${tasks.length} task${tasks.length === 1 ? "" : "s"}`;

  document.querySelectorAll("[data-check]").forEach(el => {
    el.addEventListener("change", () => toggleTask(el.dataset.check));
  });

  document.querySelectorAll("[data-delete]").forEach(el => {
    el.addEventListener("click", () => deleteTask(el.dataset.delete));
  });
}

function toggleTask(id) {
  tasks = tasks.map(task =>
    task.id === id ? { ...task, done: !task.done } : task
  );
  saveTasks();
  renderTasks();
}

function deleteTask(id) {
  tasks = tasks.filter(task => task.id !== id);
  saveTasks();
  renderTasks();
  showToast("Task removed.");
}

$("taskForm").addEventListener("submit", event => {
  event.preventDefault();

  const title = $("taskInput").value.trim();
  if (!title) return;

  tasks.unshift({
    id: Date.now().toString(36) +
        Math.random().toString(36).slice(2, 6),
    title,
    priority: $("taskPriority").value,
    done: false
  });

  saveTasks();
  $("taskInput").value = "";
  renderTasks();
  showToast("One thing added to your list.");
});

$("taskFilter").addEventListener("change", renderTasks);

$("clearDone").addEventListener("click", () => {
  const before = tasks.length;
  tasks = tasks.filter(task => !task.done);
  saveTasks();
  renderTasks();

  showToast(
    before === tasks.length
      ? "Nothing to clear."
      : "Completed tasks cleared."
  );
});

// TEXT SUMMARIZER

function updateWordCount() {
  const text = $("sourceText").value.trim();
  const count = text ? text.split(/\s+/).length : 0;

  $("wordCount").textContent =
    `${count} word${count === 1 ? "" : "s"}`;
}

$("sourceText").addEventListener("input", updateWordCount);

function splitSentences(text) {
  return (text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [])
    .map(sentence => sentence.trim())
    .filter(Boolean);
}

$("summarizeBtn").addEventListener("click", () => {
  const text = $("sourceText").value.trim();

  if (!text) {
    showToast("Paste some text first.");
    return;
  }

  const sentences = splitSentences(text);

  if (sentences.length <= 2) {
    $("summaryOutput").textContent = text;
  } else {
    const scored = sentences.map((sentence, index) => {
      const words = (
        sentence.toLowerCase().match(/[a-z0-9']+/g) || []
      ).filter(word =>
        word.length > 3 &&
        ![
          "this", "that", "with", "from", "have",
          "were", "which", "their", "there", "about",
          "will", "would", "could", "should", "then",
          "than", "when", "what", "your", "they",
          "them", "into", "also"
        ].includes(word)
      );

      return {
        sentence,
        index,
        score: words.length + Math.min(sentence.length, 150) / 100
      };
    });

    const take = Math.max(2, Math.ceil(sentences.length * 0.35));

    const chosen = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, take)
      .sort((a, b) => a.index - b.index);

    $("summaryOutput").textContent =
      chosen.map(item => item.sentence).join(" ");
  }

  showToast("Your quick read is ready.");
});

$("copySummary").addEventListener("click", async () => {
  const text = $("summaryOutput").innerText.trim();

  if (!text || text.includes("Your summary will appear")) {
    showToast("Create a summary first.");
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    showToast("Summary copied.");
  } catch {
    showToast("Clipboard unavailable. Select and copy the text.");
  }
});

// EASY-DAY PLANNER

function getEnergy() {
  return document.querySelector(
    'input[name="energy"]:checked'
  ).value;
}

function makePlan(minutes, energy, goal) {
  const title = goal ? `Focus on: ${goal}` : "Your main priority";
  const steps = [];

  if (energy === "Low") {
    steps.push(
      {
        time: "2 min",
        title: "Settle in",
        desc: "Get water, sit comfortably, and take a few slow breaths."
      },
      {
        time: `${Math.max(5, Math.round(minutes * 0.55))} min`,
        title,
        desc: "Choose the smallest useful action. Done is better than perfect."
      },
      {
        time: "3 min",
        title: "Take a real break",
        desc: "Stretch, look away from your screen, or step outside."
      }
    );
  } else if (energy === "High") {
    steps.push(
      {
        time: "5 min",
        title: "Get ready",
        desc: "Clear a little space and decide what done looks like."
      },
      {
        time: `${Math.max(10, Math.round(minutes * 0.65))} min`,
        title,
        desc: "Give this one priority. Keep distractions out of reach."
      },
      {
        time: "5 min",
        title: "Reset and review",
        desc: "Note what you finished and choose the next step."
      }
    );
  } else {
    steps.push(
      {
        time: "3 min",
        title: "Ease into it",
        desc: "Gather what you need and set one clear goal."
      },
      {
        time: `${Math.max(8, Math.round(minutes * 0.6))} min`,
        title,
        desc: "Work at a steady pace. You only need to focus on this step."
      },
      {
        time: "5 min",
        title: "Pause and recharge",
        desc: "Stand up, stretch, and celebrate the progress you made."
      }
    );
  }

  return steps;
}

$("planForm").addEventListener("submit", event => {
  event.preventDefault();

  const minutes = Number($("availableTime").value);
  const energy = getEnergy();
  const goal = $("planGoal").value.trim();

  $("energyStat").textContent = energy;

  const steps = makePlan(minutes, energy, goal);

  $("planOutput").innerHTML = `
    <h2>${
      energy === "Low"
        ? "A gentle plan."
        : energy === "High"
        ? "Let's use that momentum."
        : "A steady, doable plan."
    }</h2>
    <p class="muted">
      ${minutes} minutes · ${energy.toLowerCase()} energy ·
      Adjust it whenever you need.
    </p>
    ${steps.map(step => `
      <div class="plan-step">
        <span class="step-time">${escapeHTML(step.time)}</span>
        <div class="step-copy">
          <strong>${escapeHTML(step.title)}</strong>
          <p>${escapeHTML(step.desc)}</p>
        </div>
      </div>
    `).join("")}
  `;

  showToast("Your easy plan is ready.");
});

document.querySelectorAll('input[name="energy"]').forEach(el => {
  el.addEventListener("change", () => {
    $("energyStat").textContent = getEnergy();
  });
});

// 10-MINUTE FOCUS TIMER

function updateTimer() {
  const minutes = Math.floor(timerSeconds / 60);
  const seconds = timerSeconds % 60;

  $("timerDisplay").textContent =
    `${String(minutes).padStart(2, "0")}:` +
    `${String(seconds).padStart(2, "0")}`;
}

$("timerStart").addEventListener("click", () => {
  if (timerRunning) {
    clearInterval(timerInterval);
    timerRunning = false;
    $("timerStart").textContent = "Resume focus";
    $("timerMessage").textContent = "Paused. Take your time.";
    return;
  }

  if (timerSeconds <= 0) timerSeconds = 600;

  timerRunning = true;
  $("timerStart").textContent = "Pause";
  $("timerMessage").textContent =
    "You're doing great. One minute at a time.";

  timerInterval = setInterval(() => {
    timerSeconds--;
    updateTimer();

    if (timerSeconds <= 0) {
      clearInterval(timerInterval);
      timerRunning = false;
      $("timerStart").textContent = "Start again";
      $("timerMessage").textContent =
        "Lovely work. Take a little break. 🍃";
      showToast("Focus session complete!");
    }
  }, 1000);
});

$("timerReset").addEventListener("click", () => {
  clearInterval(timerInterval);
  timerRunning = false;
  timerSeconds = 600;
  updateTimer();
  $("timerStart").textContent = "Start focus";
  $("timerMessage").textContent = "No pressure. Just begin.";
});

// INITIALIZE THE WEBSITE

renderTasks();
updateTimer();
updateWordCount();
