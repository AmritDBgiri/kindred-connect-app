document.addEventListener('DOMContentLoaded', function() {
    const userListDiv = document.getElementById('user-list');

    fetch('/api/users')
        .then(response => response.json())
        .then(users => {
            userListDiv.innerHTML = '';
            users.forEach(user => {
                // Create the link element
                const profileLink = document.createElement('a');
                profileLink.href = `/user/${user._id}`; // Link to the unique user profile page
                profileLink.style.textDecoration = 'none';
                profileLink.style.color = 'inherit';

                // Create the card element
                const userCard = document.createElement('div');
                userCard.className = 'user-card';
                userCard.innerHTML = `
                    <h3>${user.name}</h3>
                    <p>Age: ${user.age}</p>
                    <p>Email: ${user.email}</p>
                `;
                
                // Put the card inside the link
                profileLink.appendChild(userCard);
                // Add the link (with the card inside) to the page
                userListDiv.appendChild(profileLink);
            });
        })
        .catch(error => {
            console.error('Error fetching users:', error);
            userListDiv.innerHTML = '<p>Could not load members at this time.</p>';
        });
});



