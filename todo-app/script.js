// 从本地存储加载任务
let tasks = JSON.parse(localStorage.getItem('tasks')) || [];

// DOM 元素
const taskInput = document.getElementById('taskInput');
const addBtn = document.getElementById('addBtn');
const taskList = document.getElementById('taskList');
const pendingCount = document.getElementById('pendingCount');
const completedCount = document.getElementById('completedCount');
const clearCompletedBtn = document.getElementById('clearCompletedBtn');
const clearAllBtn = document.getElementById('clearAllBtn');

// 初始化
function init() {
    renderTasks();
    updateStats();
}

// 渲染任务列表
function renderTasks() {
    taskList.innerHTML = '';

    tasks.forEach((task, index) => {
        const li = document.createElement('li');
        li.className = `task-item ${task.completed ? 'completed' : ''}`;

        li.innerHTML = `
            <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}>
            <span class="task-text">${escapeHtml(task.text)}</span>
            <div class="task-buttons">
                <button class="edit-btn">编辑</button>
                <button class="delete-btn">删除</button>
            </div>
        `;

        // 复选框事件
        const checkbox = li.querySelector('.task-checkbox');
        checkbox.addEventListener('change', () => toggleTask(index));

        // 编辑按钮事件
        const editBtn = li.querySelector('.edit-btn');
        editBtn.addEventListener('click', () => editTask(index));

        // 删除按钮事件
        const deleteBtn = li.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', () => deleteTask(index));

        taskList.appendChild(li);
    });
}

// 添加任务
function addTask() {
    const text = taskInput.value.trim();

    if (text === '') {
        alert('请输入任务内容！');
        return;
    }

    tasks.push({
        text: text,
        completed: false
    });

    saveTasks();
    renderTasks();
    updateStats();
    taskInput.value = '';
    taskInput.focus();
}

// 切换任务完成状态
function toggleTask(index) {
    tasks[index].completed = !tasks[index].completed;
    saveTasks();
    renderTasks();
    updateStats();
}

// 删除任务
function deleteTask(index) {
    tasks.splice(index, 1);
    saveTasks();
    renderTasks();
    updateStats();
}

// 编辑任务
function editTask(index) {
    const taskText = tasks[index].text;
    const newText = prompt('编辑任务:', taskText);

    if (newText !== null && newText.trim() !== '') {
        tasks[index].text = newText.trim();
        saveTasks();
        renderTasks();
    }
}

// 清除已完成的任务
function clearCompleted() {
    if (tasks.filter(task => task.completed).length === 0) {
        alert('没有已完成的任务！');
        return;
    }

    if (confirm('确定要清除所有已完成的任务吗？')) {
        tasks = tasks.filter(task => !task.completed);
        saveTasks();
        renderTasks();
        updateStats();
    }
}

// 清除全部任务
function clearAll() {
    if (tasks.length === 0) {
        alert('没有任务可以清除！');
        return;
    }

    if (confirm('确定要清除所有任务吗？')) {
        tasks = [];
        saveTasks();
        renderTasks();
        updateStats();
    }
}

// 更新统计
function updateStats() {
    const completed = tasks.filter(task => task.completed).length;
    const pending = tasks.length - completed;

    pendingCount.textContent = `未完成: ${pending}`;
    completedCount.textContent = `已完成: ${completed}`;
}

// 保存任务到本地存储
function saveTasks() {
    localStorage.setItem('tasks', JSON.stringify(tasks));
}

// HTML转义，防止XSS攻击
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 事件监听
addBtn.addEventListener('click', addTask);

taskInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        addTask();
    }
});

clearCompletedBtn.addEventListener('click', clearCompleted);
clearAllBtn.addEventListener('click', clearAll);

// 初始化应用
init();