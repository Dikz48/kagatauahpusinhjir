let currentChatId = null;
let isGenerating = false;
let currentAbortController = null;
let allChats = [];

document.addEventListener('DOMContentLoaded', function() {
  initializeChatPage();
});

function initializeChatPage() {
  loadChatHistory();
  setupChatEvents();
  renderChatHistory();
  focusInput();
}

function setupChatEvents() {
  const sendBtn = document.getElementById('sendBtn');
  const input = document.getElementById('chatInput');
  const stopBtn = document.getElementById('stopBtn');

  if (input) {
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    input.addEventListener('input', function() {
      autoResizeTextarea();
    });
  }

  if (sendBtn) {
    sendBtn.addEventListener('click', sendMessage);
  }

  if (stopBtn) {
    stopBtn.addEventListener('click', stopGeneration);
  }
}

function autoResizeTextarea() {
  const input = document.getElementById('chatInput');
  if (input) {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 150) + 'px';
  }
}

function focusInput() {
  const input = document.getElementById('chatInput');
  if (input) {
    input.focus();
  }
}

async function sendMessage() {
  const input = document.getElementById('chatInput');
  if (!input || !input.value.trim() || isGenerating) {
    return;
  }

  const message = input.value.trim();
  input.value = '';
  input.style.height = 'auto';

  addMessageToChat('user', message);
  isGenerating = true;
  updateSendButton();

  try {
    currentAbortController = new AbortController();
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: message,
        chatId: currentChatId,
        model: currentModel
      }),
      signal: currentAbortController.signal
    });

    if (!response.ok) {
      throw new Error('Failed to get response from server');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let assistantMessage = '';
    let messageElement = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            break;
          }
          
          try {
            const json = JSON.parse(data);
            if (json.content) {
              assistantMessage += json.content;
              if (!messageElement) {
                messageElement = addMessageToChat('assistant', assistantMessage, true);
              } else {
                updateMessage(messageElement, assistantMessage);
              }
              autoScrollChat();
            }
          } catch (e) {
            console.error('Failed to parse chunk:', e);
          }
        }
      }
    }

    if (messageElement) {
      finalizeMessage(messageElement);
    }
    saveChat();
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('Generation stopped by user');
    } else {
      console.error('Error:', error);
      showToast('Error communicating with server', 'error');
      addMessageToChat('system', 'Sorry, there was an error processing your request.');
    }
  } finally {
    isGenerating = false;
    updateSendButton();
    focusInput();
  }
}

function addMessageToChat(role, content, isStreaming = false) {
  const messagesContainer = document.getElementById('chatMessages');
  if (!messagesContainer) return;

  const messageDiv = document.createElement('div');
  messageDiv.className = `message message-${role}`;

  if (role === 'user') {
    messageDiv.innerHTML = `<div class="message-content">${escapeHtml(content)}</div>`;
  } else {
    messageDiv.innerHTML = `<div class="message-content" id="msg-${Date.now()}">${marked.parse(content)}</div>`;
  }

  messagesContainer.appendChild(messageDiv);
  autoScrollChat();

  if (isStreaming) {
    return messageDiv.querySelector('.message-content');
  }
}

function updateMessage(element, content) {
  if (element) {
    element.innerHTML = marked.parse(content);
    highlightCode();
  }
}

function finalizeMessage(element) {
  if (element) {
    highlightCode();
    addMessageActions(element);
  }
}

function addMessageActions(element) {
  const parent = element.parentElement;
  if (parent && !parent.querySelector('.message-actions')) {
    const actions = document.createElement('div');
    actions.className = 'message-actions';
    actions.innerHTML = `
      <button class="action-btn" onclick="copyMessage(this)">📋 Copy</button>
      <button class="action-btn" onclick="regenerateMessage(this)">🔄 Regenerate</button>
    `;
    parent.appendChild(actions);
  }
}

function copyMessage(btn) {
  const message = btn.closest('.message').querySelector('.message-content').textContent;
  navigator.clipboard.writeText(message).then(() => {
    showToast('Copied to clipboard', 'success');
  });
}

function regenerateMessage(btn) {
  const messageEl = btn.closest('.message').querySelector('.message-content');
  if (messageEl && messageEl.textContent) {
    document.getElementById('chatInput').value = messageEl.textContent;
    focusInput();
  }
}

function highlightCode() {
  document.querySelectorAll('pre code').forEach(block => {
    if (!block.classList.contains('hljs')) {
      hljs.highlightElement(block);
    }
  });
}

function autoScrollChat() {
  const messagesContainer = document.getElementById('chatMessages');
  if (messagesContainer) {
    setTimeout(() => {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }, 0);
  }
}

function updateSendButton() {
  const sendBtn = document.getElementById('sendBtn');
  const stopBtn = document.getElementById('stopBtn');
  
  if (isGenerating) {
    if (sendBtn) sendBtn.style.display = 'none';
    if (stopBtn) stopBtn.style.display = 'block';
  } else {
    if (sendBtn) sendBtn.style.display = 'block';
    if (stopBtn) stopBtn.style.display = 'none';
  }
}

function stopGeneration() {
  if (currentAbortController) {
    currentAbortController.abort();
    isGenerating = false;
    updateSendButton();
  }
}

function loadChatHistory() {
  const saved = localStorage.getItem('chatHistory');
  if (saved) {
    try {
      allChats = JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load chat history:', e);
      allChats = [];
    }
  }
}

function saveChat() {
  localStorage.setItem('chatHistory', JSON.stringify(allChats));
}

function renderChatHistory() {
  const historyContainer = document.getElementById('chatHistory');
  if (!historyContainer) return;

  historyContainer.innerHTML = '';
  allChats.forEach(chat => {
    const item = document.createElement('div');
    item.className = 'chat-history-item';
    if (chat.id === currentChatId) {
      item.classList.add('active');
    }
    item.innerHTML = `
      <div class="chat-history-title" onclick="loadChat('${chat.id}')">${escapeHtml(chat.title)}</div>
      <button class="chat-history-delete" onclick="deleteChat('${chat.id}')">🗑️</button>
    `;
    historyContainer.appendChild(item);
  });
}

function loadChat(chatId) {
  const chat = allChats.find(c => c.id === chatId);
  if (chat) {
    currentChatId = chatId;
    const messagesContainer = document.getElementById('chatMessages');
    if (messagesContainer) {
      messagesContainer.innerHTML = '';
      chat.messages.forEach(msg => {
        addMessageToChat(msg.role, msg.content);
      });
    }
    renderChatHistory();
    closeSidebar();
  }
}

function deleteChat(chatId) {
  if (confirm('Delete this chat?')) {
    allChats = allChats.filter(c => c.id !== chatId);
    saveChat();
    renderChatHistory();
    if (currentChatId === chatId) {
      newChat();
    }
  }
}

function exportChat() {
  if (currentChatId) {
    const chat = allChats.find(c => c.id === currentChatId);
    if (chat) {
      const json = JSON.stringify(chat, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chat-${chat.id}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }
}

function clearChat() {
  if (confirm('Clear all messages in this chat?')) {
    const messagesContainer = document.getElementById('chatMessages');
    if (messagesContainer) {
      messagesContainer.innerHTML = '';
    }
    if (currentChatId) {
      const chat = allChats.find(c => c.id === currentChatId);
      if (chat) {
        chat.messages = [];
        saveChat();
      }
    }
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Export to global scope
window.sendMessage = sendMessage;
window.stopGeneration = stopGeneration;
window.newChat = newChat;
window.loadChat = loadChat;
window.deleteChat = deleteChat;
window.exportChat = exportChat;
window.clearChat = clearChat;
window.copyMessage = copyMessage;
window.regenerateMessage = regenerateMessage;
window.toggleSidebar = toggleSidebar;
window.closeSidebar = closeSidebar;
