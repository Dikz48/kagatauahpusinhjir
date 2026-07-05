let allHistoryChats = [];

document.addEventListener('DOMContentLoaded', function() {
  loadHistory();
  setupHistoryEvents();
});

function loadHistory() {
  const saved = localStorage.getItem('chatHistory');
  if (saved) {
    try {
      allHistoryChats = JSON.parse(saved);
      renderHistory();
    } catch (e) {
      console.error('Failed to load history:', e);
    }
  }
}

function setupHistoryEvents() {
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', filterHistory);
  }
}

function renderHistory() {
  const list = document.getElementById('historyList');
  if (!list) return;

  list.innerHTML = '';
  allHistoryChats.forEach(chat => {
    const item = document.createElement('div');
    item.className = 'history-item';
    const preview = chat.messages.length > 0 ? chat.messages[0].content.substring(0, 100) : 'No messages';
    item.innerHTML = `
      <div class="history-item-info">
        <div class="history-title">${escapeHtml(chat.title)}</div>
        <div class="history-preview">${escapeHtml(preview)}</div>
        <div class="history-date">${new Date(chat.createdAt).toLocaleDateString()}</div>
      </div>
      <div class="history-actions">
        <button onclick="renameChat('${chat.id}')" class="btn-secondary">✏️ Rename</button>
        <button onclick="deleteHistoryChat('${chat.id}')" class="btn-danger">🗑️ Delete</button>
      </div>
    `;
    list.appendChild(item);
  });
}

function filterHistory(e) {
  const query = e.target.value.toLowerCase();
  const items = document.querySelectorAll('.history-item');
  items.forEach(item => {
    const title = item.querySelector('.history-title').textContent.toLowerCase();
    const preview = item.querySelector('.history-preview').textContent.toLowerCase();
    item.style.display = (title.includes(query) || preview.includes(query)) ? 'flex' : 'none';
  });
}

function renameChat(chatId) {
  const chat = allHistoryChats.find(c => c.id === chatId);
  if (chat) {
    const newName = prompt('New name:', chat.title);
    if (newName) {
      chat.title = newName;
      localStorage.setItem('chatHistory', JSON.stringify(allHistoryChats));
      renderHistory();
    }
  }
}

function deleteHistoryChat(chatId) {
  if (confirm('Delete this chat?')) {
    allHistoryChats = allHistoryChats.filter(c => c.id !== chatId);
    localStorage.setItem('chatHistory', JSON.stringify(allHistoryChats));
    renderHistory();
  }
}

function clearAllHistory() {
  if (confirm('Clear all chat history? This cannot be undone.')) {
    allHistoryChats = [];
    localStorage.removeItem('chatHistory');
    renderHistory();
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

window.renameChat = renameChat;
window.deleteHistoryChat = deleteHistoryChat;
window.clearAllHistory = clearAllHistory;
