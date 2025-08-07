document.addEventListener('DOMContentLoaded', () => {
    const friendListDiv = document.getElementById('friend-list');

    // Fetch the list of friends from our server's API
    fetch('/api/friends')
        .then(response => response.json())
        .then(friends => {
            friendListDiv.innerHTML = '';
            if (friends.length === 0) {
                friendListDiv.innerHTML = '<p>You haven\'t added any friends yet. Go to the Members page to connect with people!</p>';
                return;
            }

            friends.forEach(user => {
                const friendCard = document.createElement('div');
                friendCard.className = 'user-card';
                friendCard.innerHTML = `
                    <h3>${user.name}</h3>
                    <p>Age: ${user.age}</p>
                    <p>Email: ${user.email}</p>
                `;
                friendListDiv.appendChild(friendCard);
            });
        })
        .catch(error => {
            console.error('Error fetching friends:', error);
            friendListDiv.innerHTML = '<p>Could not load friends at this time.</p>';
        });
});

