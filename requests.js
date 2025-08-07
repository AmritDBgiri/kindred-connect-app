document.addEventListener('DOMContentLoaded', () => {
    const requestListDiv = document.getElementById('request-list');

    // Fetch the list of users who have sent requests
    fetch('/api/requests')
        .then(response => response.json())
        .then(requests => {
            requestListDiv.innerHTML = '';
            if (requests.length === 0) {
                requestListDiv.innerHTML = '<p>You have no new friend requests.</p>';
                return;
            }

            requests.forEach(user => {
                const requestCard = document.createElement('div');
                requestCard.className = 'request-card';
                requestCard.innerHTML = `
                    <div class="request-card-info">
                        <h3>${user.name}</h3>
                        <p>${user.email}</p>
                    </div>
                    <div class="request-card-actions">
                        <button class="accept-btn" data-id="${user._id}">Accept</button>
                    </div>
                `;
                requestListDiv.appendChild(requestCard);
            });
        });

    // Add a single event listener to the parent container for all accept buttons
    requestListDiv.addEventListener('click', (event) => {
        if (event.target.classList.contains('accept-btn')) {
            const senderId = event.target.dataset.id;
            acceptRequest(senderId, event.target);
        }
    });
});

function acceptRequest(senderId, buttonElement) {
    fetch(`/api/request/accept/${senderId}`, { method: 'POST' })
        .then(response => response.json())
        .then(data => {
            alert(data.message);
            // Visually remove the card from the page
            buttonElement.closest('.request-card').remove();
        })
        .catch(error => console.error('Error accepting request:', error));
}
