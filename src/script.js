/**
 * Todo Application powered by Puter.js
 * 
 * This app demonstrates how to use Puter.js key-value store for persistent cloud storage.
 * All todos are automatically saved to the user's Puter cloud storage and synchronized
 * across devices when the user is signed in.
 */

class TodoApp {
    constructor() {
        // Key for storing todos in Puter's key-value store
        this.STORAGE_KEY = 'todos';
        
        // Current filter state (all, active, completed)
        this.currentFilter = 'all';
        
        // Array to hold all todo items
        this.todos = [];
        
        // Counter for generating unique IDs
        this.nextId = 1;
        
        // DOM element references (cached for performance)
        this.elements = {
            todoInput: document.getElementById('todoInput'),
            addBtn: document.getElementById('addBtn'),
            todoList: document.getElementById('todoList'),
            emptyState: document.getElementById('emptyState'),
            todoCount: document.getElementById('todoCount'),
            clearCompleted: document.getElementById('clearCompleted'),
            filterBtns: document.querySelectorAll('.filter-btn'),
            loadingIndicator: document.getElementById('loadingIndicator'),
            statusMessage: document.getElementById('statusMessage')
        };
        
        this.init();
    }
    
    /**
     * Initialize the application
     * Sets up event listeners and loads data from Puter's cloud storage
     */
    async init() {
        this.setupEventListeners();
        await this.loadTodos();
        this.render();
    }
    
    /**
     * Set up all event listeners for the application
     */
    setupEventListeners() {
        // Add todo button click
        this.elements.addBtn.addEventListener('click', () => this.addTodo());
        
        // Enter key in input field
        this.elements.todoInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.addTodo();
            }
        });
        
        // Filter button clicks
        this.elements.filterBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.setFilter(e.target.dataset.filter);
            });
        });
        
        // Clear completed button
        this.elements.clearCompleted.addEventListener('click', () => this.clearCompleted());
    }
    
    /**
     * Load todos from Puter's key-value store
     * This method handles the cloud synchronization automatically
     */
    async loadTodos() {
        try {
            this.showLoading(true);
            
            // Use Puter's key-value store to retrieve saved todos
            // The KV store is automatically scoped to the current user and app
            const savedTodos = await puter.kv.get(this.STORAGE_KEY);
            
            if (savedTodos) {
                // Parse the JSON string back to an array of todos
                this.todos = JSON.parse(savedTodos);
                
                // Update the next ID counter to avoid collisions
                this.nextId = Math.max(...this.todos.map(todo => todo.id), 0) + 1;
                
                this.showStatus('Todos loaded from cloud', 'success');
            } else {
                // No saved todos found, start with empty array
                this.todos = [];
                this.showStatus('No saved todos found', 'success');
            }
        } catch (error) {
            console.error('Error loading todos from Puter KV store:', error);
            this.showStatus('Failed to load todos from cloud', 'error');
            
            // Fallback to empty array if cloud loading fails
            this.todos = [];
        } finally {
            this.showLoading(false);
        }
    }
    
    /**
     * Save todos to Puter's key-value store
     * This automatically syncs the data to the user's cloud storage
     */
    async saveTodos() {
        try {
            // Convert todos array to JSON string for storage
            const todosJson = JSON.stringify(this.todos);
            
            // Save to Puter's key-value store
            // This will automatically sync to the cloud and be available across devices
            await puter.kv.set(this.STORAGE_KEY, todosJson);
            
            this.showStatus('Todos saved to cloud', 'success');
        } catch (error) {
            console.error('Error saving todos to Puter KV store:', error);
            this.showStatus('Failed to save todos to cloud', 'error');
        }
    }
    
    /**
     * Add a new todo item
     */
    async addTodo() {
        const text = this.elements.todoInput.value.trim();
        
        if (!text) {
            this.showStatus('Please enter a todo item', 'error');
            return;
        }
        
        // Create new todo object
        const newTodo = {
            id: this.nextId++,
            text: text,
            completed: false,
            createdAt: new Date().toISOString()
        };
        
        // Add to todos array
        this.todos.unshift(newTodo); // Add to beginning for newest-first order
        
        // Clear input field
        this.elements.todoInput.value = '';
        
        // Save to cloud and re-render
        await this.saveTodos();
        this.render();
        
        this.showStatus('Todo added successfully', 'success');
    }
    
    /**
     * Toggle the completed status of a todo
     */
    async toggleTodo(id) {
        const todo = this.todos.find(t => t.id === id);
        if (todo) {
            todo.completed = !todo.completed;
            await this.saveTodos();
            this.render();
        }
    }
    
    /**
     * Delete a todo item
     */
    async deleteTodo(id) {
        this.todos = this.todos.filter(t => t.id !== id);
        await this.saveTodos();
        this.render();
        this.showStatus('Todo deleted', 'success');
    }
    
    /**
     * Start editing a todo item
     */
    editTodo(id) {
        const todo = this.todos.find(t => t.id === id);
        if (!todo) return;
        
        const todoElement = document.querySelector(`[data-id="${id}"]`);
        const textElement = todoElement.querySelector('.todo-text');
        const actionsElement = todoElement.querySelector('.todo-actions');
        
        // Create edit input
        const editInput = document.createElement('input');
        editInput.type = 'text';
        editInput.className = 'todo-edit-input';
        editInput.value = todo.text;
        
        // Create save and cancel buttons
        const editActions = document.createElement('div');
        editActions.className = 'edit-actions';
        
        const saveBtn = document.createElement('button');
        saveBtn.className = 'save-btn';
        saveBtn.textContent = 'Save';
        saveBtn.onclick = () => this.saveEdit(id, editInput.value);
        
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'cancel-btn';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.onclick = () => this.render();
        
        editActions.appendChild(saveBtn);
        editActions.appendChild(cancelBtn);
        
        // Replace text and actions with edit form
        textElement.replaceWith(editInput);
        actionsElement.replaceWith(editActions);
        
        // Focus the input
        editInput.focus();
        editInput.select();
        
        // Handle Enter key
        editInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.saveEdit(id, editInput.value);
            } else if (e.key === 'Escape') {
                this.render();
            }
        });
    }
    
    /**
     * Save the edited todo text
     */
    async saveEdit(id, newText) {
        const trimmedText = newText.trim();
        
        if (!trimmedText) {
            this.showStatus('Todo text cannot be empty', 'error');
            return;
        }
        
        const todo = this.todos.find(t => t.id === id);
        if (todo) {
            todo.text = trimmedText;
            await this.saveTodos();
            this.render();
            this.showStatus('Todo updated', 'success');
        }
    }
    
    /**
     * Clear all completed todos
     */
    async clearCompleted() {
        const completedCount = this.todos.filter(t => t.completed).length;
        
        if (completedCount === 0) {
            this.showStatus('No completed todos to clear', 'error');
            return;
        }
        
        this.todos = this.todos.filter(t => !t.completed);
        await this.saveTodos();
        this.render();
        this.showStatus(`Cleared ${completedCount} completed todo${completedCount > 1 ? 's' : ''}`, 'success');
    }
    
    /**
     * Set the current filter (all, active, completed)
     */
    setFilter(filter) {
        this.currentFilter = filter;
        
        // Update active filter button
        this.elements.filterBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });
        
        this.render();
    }
    
    /**
     * Get filtered todos based on current filter
     */
    getFilteredTodos() {
        switch (this.currentFilter) {
            case 'active':
                return this.todos.filter(t => !t.completed);
            case 'completed':
                return this.todos.filter(t => t.completed);
            default:
                return this.todos;
        }
    }
    
    /**
     * Render the todo list and update UI
     */
    render() {
        const filteredTodos = this.getFilteredTodos();
        const activeTodos = this.todos.filter(t => !t.completed);
        const completedTodos = this.todos.filter(t => t.completed);
        
        // Clear the todo list
        this.elements.todoList.innerHTML = '';
        
        // Show/hide empty state
        if (filteredTodos.length === 0) {
            this.elements.emptyState.style.display = 'block';
            this.elements.todoList.style.display = 'none';
        } else {
            this.elements.emptyState.style.display = 'none';
            this.elements.todoList.style.display = 'block';
            
            // Render each todo item
            filteredTodos.forEach(todo => {
                const li = this.createTodoElement(todo);
                this.elements.todoList.appendChild(li);
            });
        }
        
        // Update todo count
        const activeCount = activeTodos.length;
        this.elements.todoCount.textContent = `${activeCount} item${activeCount !== 1 ? 's' : ''} left`;
        
        // Update clear completed button
        this.elements.clearCompleted.disabled = completedTodos.length === 0;
    }
    
    /**
     * Create a DOM element for a todo item
     */
    createTodoElement(todo) {
        const li = document.createElement('li');
        li.className = `todo-item ${todo.completed ? 'completed' : ''}`;
        li.dataset.id = todo.id;
        
        li.innerHTML = `
            <input 
                type="checkbox" 
                class="todo-checkbox" 
                ${todo.completed ? 'checked' : ''}
                onchange="app.toggleTodo(${todo.id})"
            >
            <span class="todo-text">${this.escapeHtml(todo.text)}</span>
            <div class="todo-actions">
                <button class="todo-edit-btn" onclick="app.editTodo(${todo.id})">Edit</button>
                <button class="todo-delete-btn" onclick="app.deleteTodo(${todo.id})">Delete</button>
            </div>
        `;
        
        return li;
    }
    
    /**
     * Escape HTML to prevent XSS attacks
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    /**
     * Show or hide loading indicator
     */
    showLoading(show) {
        this.elements.loadingIndicator.classList.toggle('show', show);
    }
    
    /**
     * Show status message to user
     */
    showStatus(message, type = 'success') {
        const statusEl = this.elements.statusMessage;
        statusEl.textContent = message;
        statusEl.className = `status-message ${type}`;
        statusEl.classList.add('show');
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            statusEl.classList.remove('show');
        }, 3000);
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Create global app instance so event handlers can access it
    window.app = new TodoApp();
});