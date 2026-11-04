// Pequeño bus de eventos de la interfaz (modales globales y refresco de listas)
export const TASKS_EVENT = 'nexo:tasks-changed';
export const notifyTasksChanged = () => window.dispatchEvent(new Event(TASKS_EVENT));

export const openCreateTask = (assignee = null) => window.dispatchEvent(new CustomEvent('nexo:create-task', { detail: { assignee } }));
export const openCompleteTask = (task) => window.dispatchEvent(new CustomEvent('nexo:complete-task', { detail: { task } }));
