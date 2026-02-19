// ==========================================
// FIREBASE CONFIGURATION
// Replace with your own Firebase config from Firebase Console
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyA8Qxu_Z8_NkSolQW9CIT0v4y1d3gwxGe8",
    authDomain: "messene-388c7.firebaseapp.com",
    databaseURL: "https://messene-388c7-default-rtdb.firebaseio.com",
    projectId: "messene-388c7",
    storageBucket: "messene-388c7.firebasestorage.app",
    messagingSenderId: "1064091008059",
    appId: "1:1064091008059:web:97ade5c514fd2ee754301e"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// ==========================================
// APP STATE
// ==========================================
let currentUser = {
    id: 'user_' + Math.random().toString(36).substr(2, 9),
    name: '',
    age: '',
    avatar: null,
    online: true,
    lastSeen: Date.now()
};

let replyingTo = null;
let isProfileComplete = false;
let currentChat = 'main'; // 'main' or userId for private
let viewingProfile = null;
let messagesRef = null;
let usersRef = null;
let typingRef = null;
let currentUserRef = null;

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    checkExistingProfile();
    setupEventListeners();
});

// ==========================================
// PROFILE FUNCTIONS
// ==========================================
function checkExistingProfile() {
    const stored = localStorage.getItem('chadwfriends_profile');
    const hasCompleted = localStorage.getItem('chadwfriends_setup_complete');
    
    if (stored && hasCompleted === 'true') {
        const profile = JSON.parse(stored);
        currentUser = { ...currentUser, ...profile };
        isProfileComplete = true;
        
        document.getElementById('introScreen').classList.add('hidden');
        document.getElementById('appContainer').classList.add('show');
        
        updateAllProfileUI();
        initFirebase();
        initChat();
    }
}

function enterApp() {
    document.getElementById('introScreen').classList.add('hidden');
    
    if (!isProfileComplete) {
        setTimeout(() => {
            document.getElementById('profileModal').classList.add('show');
        }, 300);
    } else {
        document.getElementById('appContainer').classList.add('show');
        initFirebase();
        initChat();
    }
}

function handleSetupImage(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('setupProfileImage').src = e.target.result;
        document.getElementById('setupProfileImage').style.display = 'block';
        document.getElementById('setupPlaceholder').style.display = 'none';
        currentUser.avatar = e.target.result;
    };
    reader.readAsDataURL(file);
}

function saveSetupProfile() {
    const name = document.getElementById('setupName').value.trim();
    const age = document.getElementById('setupAge').value;
    
    if (!name) {
        alert('Please enter your name');
        return;
    }
    
    currentUser.name = name;
    currentUser.age = age;
    
    localStorage.setItem('chadwfriends_profile', JSON.stringify(currentUser));
    localStorage.setItem('chadwfriends_setup_complete', 'true');
    
    isProfileComplete = true;
    document.getElementById('profileModal').classList.remove('show');
    document.getElementById('appContainer').classList.add('show');
    
    updateAllProfileUI();
    initFirebase();
    initChat();
}

function updateAllProfileUI() {
    // Sidebar
    const sidebarName = document.getElementById('sidebarName');
    const sidebarAge = document.getElementById('sidebarAge');
    const sidebarImage = document.getElementById('sidebarImage');
    const sidebarPlaceholder = document.getElementById('sidebarPlaceholder');
    
    if (sidebarName) sidebarName.textContent = currentUser.name;
    if (sidebarAge) sidebarAge.textContent = currentUser.age ? currentUser.age + ' years old' : '--';
    
    if (currentUser.avatar && sidebarImage) {
        sidebarImage.src = currentUser.avatar;
        sidebarImage.style.display = 'block';
        if (sidebarPlaceholder) sidebarPlaceholder.style.display = 'none';
    }
    
    // Drawer
    const drawerName = document.getElementById('drawerName');
    const drawerAge = document.getElementById('drawerAge');
    const drawerImage = document.getElementById('drawerImage');
    const drawerPlaceholder = document.getElementById('drawerPlaceholder');
    
    if (drawerName) drawerName.textContent = currentUser.name;
    if (drawerAge) drawerAge.textContent = currentUser.age ? currentUser.age + ' years old' : '';
    
    if (currentUser.avatar && drawerImage) {
        drawerImage.src = currentUser.avatar;
        drawerImage.style.display = 'block';
        if (drawerPlaceholder) drawerPlaceholder.style.display = 'none';
    }
}

// ==========================================
// FIREBASE INITIALIZATION
// ==========================================
function initFirebase() {
    // User presence - track online status
    usersRef = database.ref('users');
    currentUserRef = usersRef.child(currentUser.id);
    
    // Set user as online
    currentUserRef.set({
        ...currentUser,
        online: true,
        lastSeen: Date.now()
    });
    
    // Remove user when disconnected
    currentUserRef.onDisconnect().remove();
    
    // Listen for online users
    usersRef.on('value', (snapshot) => {
        const users = snapshot.val() || {};
        updateUsersList(users);
    });
    
    // Listen for messages in main chat
    listenToMessages('main');
    
    // Listen for typing indicators
    listenToTyping();
}

// ==========================================
// CHAT & MESSAGING FUNCTIONS
// ==========================================
function listenToMessages(chatId) {
    // Remove previous listeners
    if (messagesRef) {
        messagesRef.off();
    }
    
    messagesRef = database.ref('messages/' + chatId);
    
    // Listen for new messages
    messagesRef.limitToLast(50).on('child_added', (snapshot) => {
        const message = snapshot.val();
        const isOwn = message.userId === currentUser.id;
        
        // Don't show if already displayed
        if (!document.getElementById(message.id)) {
            displayMessage(message, isOwn);
        }
    });
    
    // Listen for deleted messages
    messagesRef.on('child_removed', (snapshot) => {
        const messageId = snapshot.val().id;
        const el = document.getElementById(messageId);
        if (el) {
            el.style.opacity = '0';
            el.style.transform = 'translateX(50px)';
            setTimeout(() => el.remove(), 300);
        }
    });
}

function sendMessage() {
    const input = document.getElementById('messageInput');
    const text = input.value.trim();
    if (!text) return;
    
    const messageData = {
        id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        text: text,
        userId: currentUser.id,
        userName: currentUser.name,
        userAvatar: currentUser.avatar,
        timestamp: Date.now(),
        replyTo: replyingTo,
        chat: currentChat
    };
    
    // Save to Firebase
    const newMessageRef = messagesRef.push();
    newMessageRef.set(messageData);
    
    // Clear input
    input.value = '';
    input.style.height = 'auto';
    cancelReply();
    
    // Stop typing indicator
    stopTyping();
}

function displayMessage(message, isOwn) {
    const container = document.getElementById('messagesContainer');
    
    const wrapper = document.createElement('div');
    wrapper.className = 'message-with-avatar ' + (isOwn ? 'own' : 'other');
    wrapper.id = message.id;
    
    // Avatar
    let avatarHtml = '';
    if (message.userAvatar) {
        avatarHtml = '<img src="' + message.userAvatar + '" class="message-avatar" onclick="viewMessageProfile(\'' + message.userId + '\')" alt="Avatar">';
    } else {
        avatarHtml = '<div class="message-avatar-placeholder" onclick="viewMessageProfile(\'' + message.userId + '\')">' + message.userName[0].toUpperCase() + '</div>';
    }
    
    // Message bubble
    const time = new Date(message.timestamp).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    });
    
    let bubbleHtml = '<div class="message-bubble">';
    if (message.replyTo) {
        bubbleHtml += '<div class="reply-reference">↳ ' + escapeHtml(message.replyTo.userName) + ': ' + escapeHtml(message.replyTo.text) + '</div>';
    }
    bubbleHtml += '<div class="message-header">';
    bubbleHtml += '<span class="message-author">' + escapeHtml(message.userName) + '</span>';
    bubbleHtml += '<span class="message-time">' + time + '</span>';
    bubbleHtml += '</div>';
    bubbleHtml += '<div class="message-content">' + escapeHtml(message.text) + '</div>';
    bubbleHtml += '</div>';
    
    // Actions - Reply and Delete buttons
    let actionsHtml = '<div class="message-actions">';
    actionsHtml += '<button class="action-btn" onclick="initiateReply(\'' + message.id + '\', \'' + escapeHtml(message.text) + '\', \'' + message.userName + '\')" title="Reply">';
    actionsHtml += '<span>↩️</span> Reply';
    actionsHtml += '</button>';
    if (isOwn) {
        actionsHtml += '<button class="action-btn delete" onclick="deleteMessage(\'' + message.id + '\')" title="Delete">';
        actionsHtml += '<span>🗑️</span> Delete';
        actionsHtml += '</button>';
    }
    actionsHtml += '</div>';
    
    wrapper.innerHTML = avatarHtml + '<div style="flex: 1; max-width: 75%;">' + bubbleHtml + actionsHtml + '</div>';
    
    container.appendChild(wrapper);
    container.scrollTop = container.scrollHeight;
    
    // Remove welcome message if exists
    const welcome = container.querySelector('.welcome-message');
    if (welcome) welcome.remove();
}

function deleteMessage(messageId) {
    // Remove from Firebase
    const messageRef = database.ref('messages/' + currentChat + '/' + messageId);
    messageRef.remove();
    
    // Also remove from DOM immediately
    const el = document.getElementById(messageId);
    if (el) {
        el.style.opacity = '0';
        el.style.transform = 'translateX(50px)';
        setTimeout(() => el.remove(), 300);
    }
}

function initiateReply(id, text, userName) {
    replyingTo = { id: id, text: text, userName: userName };
    document.getElementById('replyBar').classList.add('show');
    document.getElementById('replyText').textContent = text;
    document.getElementById('messageInput').focus();
}

function cancelReply() {
    replyingTo = null;
    document.getElementById('replyBar').classList.remove('show');
}

// ==========================================
// TYPING INDICATORS
// ==========================================
let typingTimeout = null;

function listenToTyping() {
    typingRef = database.ref('typing/' + currentChat);
    
    typingRef.on('value', (snapshot) => {
        const typing = snapshot.val() || {};
        let someoneTyping = false;
        let typingName = '';
        
        for (const userId in typing) {
            if (userId !== currentUser.id && typing[userId]) {
                someoneTyping = true;
                // Get user name from users list
                const userRef = database.ref('users/' + userId + '/name');
                userRef.once('value', (snap) => {
                    typingName = snap.val() || 'Someone';
                    showTypingIndicator(typingName);
                });
                break;
            }
        }
        
        if (!someoneTyping) {
            hideTypingIndicator();
        }
    });
}

function showTypingIndicator(name) {
    const indicator = document.getElementById('typingIndicator');
    const bubble = indicator.querySelector('.typing-bubble span');
    bubble.textContent = name + ' is typing';
    indicator.classList.add('show');
}

function hideTypingIndicator() {
    document.getElementById('typingIndicator').classList.remove('show');
}

function startTyping() {
    if (!currentChat) return;
    
    const typingRef = database.ref('typing/' + currentChat + '/' + currentUser.id);
    typingRef.set(true);
    
    // Clear after 3 seconds
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(stopTyping, 3000);
}

function stopTyping() {
    if (!currentChat) return;
    const typingRef = database.ref('typing/' + currentChat + '/' + currentUser.id);
    typingRef.remove();
}

// ==========================================
// USERS & PRESENCE
// ==========================================
function updateUsersList(users) {
    const mainList = document.getElementById('mainUsersList');
    const privateList = document.getElementById('privateUsersList');
    const mobilePrivateList = document.getElementById('mobilePrivateList');
    
    let onlineUsers = [];
    let mainHtml = '<div class="user-item"><span class="user-dot"></span><span>You (' + currentUser.name + ')</span></div>';
    
    for (const userId in users) {
        if (userId === currentUser.id) continue;
        
        const user = users[userId];
        onlineUsers.push(user);
        
        // Main chat users list
        mainHtml += '<div class="user-item" onclick="viewUserProfile(\'' + userId + '\')">';
        mainHtml += '<span class="user-dot"></span>';
        if (user.avatar) {
            mainHtml += '<img src="' + user.avatar + '" class="user-avatar" alt="' + user.name + '">';
        } else {
            mainHtml += '<div class="user-avatar-placeholder">' + user.name[0].toUpperCase() + '</div>';
        }
        mainHtml += '<span>' + user.name + '</span>';
        mainHtml += '</div>';
    }
    
    if (mainList) mainList.innerHTML = mainHtml;
    
    // Private chat users
    if (onlineUsers.length === 0) {
        if (privateList) privateList.innerHTML = '<div class="user-item empty"><span>No other users online</span></div>';
        if (mobilePrivateList) mobilePrivateList.innerHTML = '<div class="mobile-menu-item empty">No private chats</div>';
    } else {
        let privateHtml = '';
        let mobileHtml = '';
        
        onlineUsers.forEach(user => {
            privateHtml += '<div class="user-item" onclick="startPrivateChatWith(\'' + user.id + '\')">';
            privateHtml += '<span class="user-dot"></span>';
            privateHtml += '<span>' + user.name + '</span>';
            privateHtml += '</div>';
            
            mobileHtml += '<div class="mobile-menu-item" onclick="startPrivateChatWith(\'' + user.id + '\'); toggleMobileChatMenu();">';
            mobileHtml += '<span>👤 ' + user.name + '</span>';
            mobileHtml += '</div>';
        });
        
        if (privateList) privateList.innerHTML = privateHtml;
        if (mobilePrivateList) mobilePrivateList.innerHTML = mobileHtml;
    }
    
    // Update header with participant count
    const headerStatus = document.getElementById('connectionStatus');
    if (headerStatus && currentChat === 'main') {
        headerStatus.textContent = (onlineUsers.length + 1) + ' participants';
    }
}

// ==========================================
// CHAT NAVIGATION
// ==========================================
function switchTab(tab) {
    // Update desktop tabs
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    const desktopTab = document.getElementById('tab-' + tab);
    if (desktopTab) desktopTab.classList.add('active');
    
    // Update mobile tabs
    document.querySelectorAll('.mobile-tab-btn').forEach(btn => btn.classList.remove('active'));
    const mobileTab = document.getElementById('mobile-tab-' + tab);
    if (mobileTab) mobileTab.classList.add('active');
    
    if (tab === 'main') {
        const mainSection = document.getElementById('mainUsersSection');
        const privateSection = document.getElementById('privateUsersSection');
        if (mainSection) mainSection.style.display = 'block';
        if (privateSection) privateSection.style.display = 'none';
        switchToMainChat();
    } else {
        const mainSection = document.getElementById('mainUsersSection');
        const privateSection = document.getElementById('privateUsersSection');
        if (mainSection) mainSection.style.display = 'none';
        if (privateSection) privateSection.style.display = 'block';
        clearMessages();
        addSystemMessage('👤 Select a user from the list to start a private chat');
    }
}

function switchToMainChat() {
    currentChat = 'main';
    updateChatHeader('main');
    clearMessages();
    listenToMessages('main');
    addSystemMessage('Welcome to Main Chat! 👋');
}

function startPrivateChatWith(userId) {
    const userRef = database.ref('users/' + userId);
    userRef.once('value', (snapshot) => {
        const user = snapshot.val();
        if (!user) return;
        
        // Create private chat ID (sorted so both users get same room)
        const chatId = [currentUser.id, userId].sort().join('_');
        currentChat = chatId;
        
        updateChatHeader('private', user);
        clearMessages();
        listenToMessages(chatId);
        addSystemMessage('Started private chat with ' + user.name);
        
        // Switch to main tab visually but show private chat
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    });
}

function updateChatHeader(type, user = null) {
    const avatar = document.getElementById('chatAvatar');
    const name = document.getElementById('chatName');
    const status = document.getElementById('chatStatus');
    const headerAvatar = document.getElementById('headerAvatar');
    const headerName = document.getElementById('headerChatName');
    const headerStatus = document.getElementById('connectionStatus');
    const mobileName = document.getElementById('mobileChatName');
    
    if (type === 'main') {
        if (avatar) avatar.innerHTML = '💬';
        if (name) name.textContent = 'Main Chat';
        if (status) status.textContent = 'Group conversation';
        if (headerAvatar) headerAvatar.innerHTML = '💬';
        if (headerName) headerName.textContent = 'Main Chat';
        if (headerStatus) headerStatus.textContent = 'Group chat';
        if (mobileName) mobileName.textContent = 'Main Chat';
    } else if (user) {
        const initial = user.name ? user.name[0].toUpperCase() : '👤';
        if (avatar) avatar.innerHTML = initial;
        if (name) name.textContent = user.name;
        if (status) status.textContent = 'Private conversation';
        if (headerAvatar) headerAvatar.innerHTML = initial;
        if (headerName) headerName.textContent = user.name;
        if (headerStatus) headerStatus.textContent = 'Private chat';
        if (mobileName) mobileName.textContent = '👤 ' + user.name;
    }
}

// ==========================================
// USER PROFILES
// ==========================================
function viewUserProfile(userId) {
    const userRef = database.ref('users/' + userId);
    userRef.once('value', (snapshot) => {
        const user = snapshot.val();
        if (!user) return;
        
        viewingProfile = { ...user, id: userId };
        
        const viewName = document.getElementById('viewProfileName');
        const viewAge = document.getElementById('viewProfileAge');
        const viewImage = document.getElementById('viewProfileImage');
        const viewPlaceholder = document.getElementById('viewProfilePlaceholder');
        const privateChatBtn = document.getElementById('privateChatBtn');
        
        if (viewName) viewName.textContent = user.name;
        if (viewAge) viewAge.textContent = user.age ? user.age + ' years old' : 'Age not set';
        
        if (user.avatar && viewImage) {
            viewImage.src = user.avatar;
            viewImage.style.display = 'block';
            if (viewPlaceholder) viewPlaceholder.style.display = 'none';
        } else if (viewImage && viewPlaceholder) {
            viewImage.style.display = 'none';
            viewPlaceholder.style.display = 'flex';
        }
        
        if (privateChatBtn) privateChatBtn.style.display = 'flex';
        
        const modal = document.getElementById('userProfileModal');
        if (modal) modal.classList.add('show');
    });
}

function showUserProfile() {
    viewingProfile = currentUser;
    
    const viewName = document.getElementById('viewProfileName');
    const viewAge = document.getElementById('viewProfileAge');
    const viewImage = document.getElementById('viewProfileImage');
    const viewPlaceholder = document.getElementById('viewProfilePlaceholder');
    const privateChatBtn = document.getElementById('privateChatBtn');
    
    if (viewName) viewName.textContent = currentUser.name;
    if (viewAge) viewAge.textContent = currentUser.age ? currentUser.age + ' years old' : 'Age not set';
    
    if (currentUser.avatar && viewImage) {
        viewImage.src = currentUser.avatar;
        viewImage.style.display = 'block';
        if (viewPlaceholder) viewPlaceholder.style.display = 'none';
    } else if (viewImage && viewPlaceholder) {
        viewImage.style.display = 'none';
        viewPlaceholder.style.display = 'flex';
    }
    
    if (privateChatBtn) privateChatBtn.style.display = 'none';
    
    const modal = document.getElementById('userProfileModal');
    if (modal) modal.classList.add('show');
}

function closeUserProfile() {
    const modal = document.getElementById('userProfileModal');
    if (modal) modal.classList.remove('show');
    
    const privateChatBtn = document.getElementById('privateChatBtn');
    if (privateChatBtn) privateChatBtn.style.display = 'flex';
    
    viewingProfile = null;
}

function startPrivateChat() {
    if (viewingProfile && viewingProfile.id !== currentUser.id) {
        startPrivateChatWith(viewingProfile.id);
        closeUserProfile();
    }
}

function viewMessageProfile(userId) {
    if (userId === currentUser.id) {
        showUserProfile();
    } else {
        viewUserProfile(userId);
    }
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================
function clearMessages() {
    const container = document.getElementById('messagesContainer');
    if (container) container.innerHTML = '';
}

function addSystemMessage(text) {
    const container = document.getElementById('messagesContainer');
    if (!container) return;
    
    const div = document.createElement('div');
    div.className = 'system-message';
    div.innerHTML = '<span>' + text + '</span>';
    div.style.cssText = 'text-align: center; padding: 10px; color: var(--text-light); font-size: 0.85rem; font-style: italic;';
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ==========================================
// UI FUNCTIONS
// ==========================================
function toggleProfileDrawer() {
    const drawer = document.getElementById('profileDrawer');
    if (drawer) drawer.classList.toggle('show');
}

function toggleMobileChatMenu() {
    const menu = document.getElementById('mobileChatMenu');
    if (menu) menu.classList.toggle('show');
}

function toggleEmojiPicker() {
    const picker = document.getElementById('emojiPicker');
    if (picker) picker.classList.toggle('show');
}

function addEmoji(emoji) {
    const input = document.getElementById('messageInput');
    if (input) {
        input.value += emoji;
        toggleEmojiPicker();
        input.focus();
    }
}

function toggleTheme() {
    const html = document.documentElement;
    const current = html.getAttribute('data-theme');
    const newTheme = current === 'dark' ? 'light' : 'dark';
    
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    // Update desktop button
    const themeIcon = document.getElementById('themeIcon');
    const themeText = document.getElementById('themeText');
    if (themeIcon) themeIcon.textContent = newTheme === 'dark' ? '☀️' : '🌙';
    if (themeText) themeText.textContent = newTheme === 'dark' ? 'Light Mode' : 'Dark Mode';
    
    // Update mobile floating button
    const mobileBtn = document.getElementById('mobileThemeBtn');
    if (mobileBtn) mobileBtn.textContent = newTheme === 'dark' ? '☀️' : '🌙';
}

function showEditModal() {
    const setupName = document.getElementById('setupName');
    const setupAge = document.getElementById('setupAge');
    const setupImage = document.getElementById('setupProfileImage');
    const setupPlaceholder = document.getElementById('setupPlaceholder');
    
    if (setupName) setupName.value = currentUser.name;
    if (setupAge) setupAge.value = currentUser.age;
    
    if (currentUser.avatar && setupImage) {
        setupImage.src = currentUser.avatar;
        setupImage.style.display = 'block';
        if (setupPlaceholder) setupPlaceholder.style.display = 'none';
    }
    
    const modal = document.getElementById('profileModal');
    if (modal) modal.classList.add('show');
    
    toggleProfileDrawer();
}

function retryConnection() {
    location.reload();
}

// ==========================================
// INITIALIZATION
// ==========================================
function initChat() {
    const textarea = document.getElementById('messageInput');
    if (!textarea) return;
    
    textarea.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 100) + 'px';
        
        // Trigger typing indicator
        startTyping();
    });
    
    textarea.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // Load saved theme
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    if (savedTheme === 'dark') {
        const themeIcon = document.getElementById('themeIcon');
        const themeText = document.getElementById('themeText');
        const mobileBtn = document.getElementById('mobileThemeBtn');
        
        if (themeIcon) themeIcon.textContent = '☀️';
        if (themeText) themeText.textContent = 'Light Mode';
        if (mobileBtn) mobileBtn.textContent = '☀️';
    }
}

function setupEventListeners() {
    document.addEventListener('click', (e) => {
        // Close emoji picker when clicking outside
        if (!e.target.closest('.emoji-btn') && !e.target.closest('.emoji-picker')) {
            const picker = document.getElementById('emojiPicker');
            if (picker) picker.classList.remove('show');
        }
        
        // Close mobile chat menu when clicking outside
        if (!e.target.closest('.mobile-chat-selector') && !e.target.closest('.mobile-chat-menu')) {
            const menu = document.getElementById('mobileChatMenu');
            if (menu) menu.classList.remove('show');
        }
    });
    
    // Handle page visibility change (update online status)
    document.addEventListener('visibilitychange', () => {
        if (currentUserRef) {
            currentUserRef.update({
                online: !document.hidden,
                lastSeen: Date.now()
            });
        }
    });
    
    // Handle before unload (cleanup)
    window.addEventListener('beforeunload', () => {
        if (currentUserRef) {
            currentUserRef.remove();
        }
    });
}
