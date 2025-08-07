document.addEventListener('DOMContentLoaded', () => {
    const pathParts = window.location.pathname.split('/');
    const userId = pathParts[pathParts.length - 1];
    const profileContainer = document.getElementById('profile-container');

    fetch(`/api/user/${userId}`)
        .then(response => response.ok ? response.json() : Promise.reject('User not found'))
        .then(user => {
            document.title = `${user.name}'s Profile`;
            profileContainer.innerHTML = `
                <h2>${user.name}</h2>
                <p><strong>Email:</strong> ${user.email}</p>
                <p><strong>Age:</strong> ${user.age}</p>
                <div id="action-button-container"></div>
            `;
            // After rendering the profile, decide which button to show
            renderActionButton(user);
        })
        .catch(error => {
            console.error('Failed to load profile:', error);
            profileContainer.innerHTML = '<h2>Could not find user.</h2>';
        });
});

function renderActionButton(profileUser) {
    const container = document.getElementById('action-button-container');

    // Use the 'isFriend' status sent from the server
    if (profileUser.isFriend) {
        container.innerHTML = `<a href="/chat/private/${profileUser._id}" class="button">Start Private Chat</a>`;
    } else if (profileUser.sentRequestToMe) {
        // This user sent a request to you, show an accept button
        container.innerHTML = `<button id="accept-friend-btn" data-userid="${profileUser._id}" class="button">Accept Friend Request</button>`;
        document.getElementById('accept-friend-btn').addEventListener('click', acceptFriendRequest);
    } else {
        // Default: Not friends, no pending requests
        container.innerHTML = `<button id="add-friend-btn" data-userid="${profileUser._id}" class="button">Send Friend Request</button>`;
        document.getElementById('add-friend-btn').addEventListener('click', sendFriendRequest);
    }
}

function sendFriendRequest(event) {
    const receiverId = event.target.dataset.userid;
    fetch(`/api/request/send/${receiverId}`, { method: 'POST' })
        .then(response => response.json())
        .then(data => {
            alert(data.message);
            event.target.disabled = true;
            event.target.textContent = 'Request Sent';
        });
}

function acceptFriendRequest(event) {
    const senderId = event.target.dataset.userid;
    fetch(`/api/request/accept/${senderId}`, { method: 'POST' })
        .then(response => response.json())
        .then(data => {
            alert(data.message);
            event.target.closest('#action-button-container').innerHTML = `<a href="/chat/private/${senderId}" class="button">Start Private Chat</a>`;
        });
}

