const userUID = sessionStorage.getItem("userUID");
const userName = sessionStorage.getItem("userName");

if (userName) {
  document.getElementById("userName").textContent = userName;
}

function showTab(event, tabId) {
  // Hide all tab contents
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });

  // Remove active class from all tab buttons
  document.querySelectorAll('.tab-button').forEach(button => {
    button.classList.remove('active');
  });

  // Show the selected tab and mark the button active
  document.getElementById(tabId).classList.add('active');
  event.target.classList.add('active');
}