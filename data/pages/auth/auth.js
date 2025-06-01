// Clear UID on load
fetch("/clear-uid").catch((err) => {
  console.error("Failed to clear UID on load", err);
});

let isScanning = false;
let isBookScanning = false;
let isLoginScanning = false;

document.getElementById("loginBtn").addEventListener("click", () => {
  isLoginScanning = true;
  isScanning = false;
  isBookScanning = false;
  document.getElementById("uid").textContent = "Initializing login scan...";
  document.getElementById("status").textContent = "";

  const buttonImg = document.querySelector('.login-button img');
  const animation = document.getElementById('login_animation');

    if (buttonImg && animation) {
      buttonImg.style.display = 'none';
      animation.style.display = 'block';
    }

  fetch("/clear-uid")
    .then(() => fetch("/start-scan"))
    .catch((err) => {
      console.error("Failed to start login scan", err);
      document.getElementById("status").textContent =
        "Failed to start login scan.";
      isLoginScanning = false;
    });
});
// Scan user button event listener
document.getElementById("scanBtn").addEventListener("click", () => {
  isScanning = true;
  isBookScanning = false;
  document.getElementById("uid").textContent = "Initializing...";
  document.getElementById("status").textContent = "";

  const buttonImg = document.querySelector('.register-button img');
  const animation = document.getElementById('registration_animation');

    if (buttonImg && animation) {
      buttonImg.style.display = 'none';
      animation.style.display = 'block';
    }

  // Clear previous UID, then start scanning
  fetch("/clear-uid")
    .then(() => fetch("/start-scan"))
    .catch((err) => {
      console.error("Failed to start scan", err);
      document.getElementById("status").textContent = "Failed to start scan.";
      isScanning = false;
    });
});

// Scan book button event listener
document.getElementById("scanBookBtn").addEventListener("click", () => {
  isBookScanning = true;
  isScanning = false; // reset user scan flag
  document.getElementById("uid").textContent = "Initializing...";
  document.getElementById("status").textContent = "";

  const buttonImg = document.querySelector('.registerbook-button img');
  const animation = document.getElementById('registerbook_animation');

    if (buttonImg && animation) {
      buttonImg.style.display = 'none';
      animation.style.display = 'block';
    }

  fetch("/clear-uid")
    .then(() => fetch("/start-scan"))
    .catch((err) => {
      console.error("Failed to start scan", err);
      document.getElementById("status").textContent = "Failed to start scan.";
      isBookScanning = false;
    });
});

// Polling for UID if scan is triggered
setInterval(() => {
  if (!isScanning && !isBookScanning && !isLoginScanning) return;

  fetch("/uid?type=" + (isBookScanning ? "book" : "user"))
    .then((res) => res.json())
    .then((data) => {
      const uidElem = document.getElementById("uid");
      const formContainer = document.getElementById("formContainer");
      const bookFormContainer = document.getElementById("bookFormContainer");
      const statusElem = document.getElementById("status");

      if (!data.uid) {
        uidElem.textContent = "Please scan...";
        return;
      }

      uidElem.dataset.value = data.uid;

      if (!data.uid) {
        uidElem.textContent = "Please scan...";
        return;
      }

      uidElem.dataset.value = data.uid;

      if (isLoginScanning) {
        isLoginScanning = false;
        uidElem.textContent = `UID: ${data.uid} — Logging in`;

        if (data.registered) {
          sessionStorage.setItem("userUID", data.uid);
          sessionStorage.setItem("userName", data.name);
          console.log("User logged in:", data);
          statusElem.textContent = "Login successful. Redirecting...";

          setTimeout(() => {
            window.location.href = "/pages/dashboard/dashboard.html";
          }, 1500);
        } else {
          statusElem.textContent = "RFID not registered. Access denied.";
          setTimeout(() => {
            uidElem.textContent = "Please select an action";
            uidElem.removeAttribute("data-value");
            statusElem.textContent = "";
          }, 3000);
        }

        formContainer.classList.add("hidden");
        bookFormContainer.classList.add("hidden");
        return;
      }

      if (isBookScanning) {
        // Book scan flow
        isBookScanning = false;
        uidElem.textContent = `UID: ${data.uid} — Book`;

        if (data.registered) {
          statusElem.textContent = "Book already registered.";
          bookFormContainer.classList.add("hidden");
          document.getElementById("registerbook_button").classList.remove("hidden");
        } else {
          statusElem.textContent = "Please enter book name.";
          bookFormContainer.classList.remove("hidden");
          document.getElementById("registerbook_button").classList.add("hidden");
        }

        formContainer.classList.add("hidden");
        return;
      }

      if (isScanning) {
        // User scan flow
        isScanning = false;
        uidElem.textContent = `UID: ${data.uid}`;

        if (data.registered) {
          uidElem.textContent += " — Registered";
          statusElem.textContent = "RFID already registered.";
          formContainer.classList.add("hidden");

          const buttonImg = document.querySelector('.register-button img');
          const animation = document.getElementById('registration_animation');

          document.getElementById("register_button").classList.remove("hidden");
          
          if (buttonImg && animation) {
            animation.style.display = 'none';
            buttonImg.style.display = 'block';
          }

          // Reset UI after 3 seconds
          setTimeout(() => {
            statusElem.textContent = "";
            uidElem.textContent = "Click to scan tag";
            uidElem.removeAttribute("data-value");
            // reset flags explicitly
            isScanning = false;
            isBookScanning = false;
            formContainer.classList.add("hidden");
            bookFormContainer.classList.add("hidden");
          }, 3000);
        } else {
          uidElem.textContent += " — Not Registered";
          statusElem.textContent = "RFID not registered. Please fill the form.";
          formContainer.classList.remove("hidden");
          bookFormContainer.classList.add("hidden");
          document.getElementById("register_button").classList.add("hidden");
        }
      }
    })
    .catch((err) => {
      document.getElementById("uid").textContent = `Error: ${err.message}`;
    });
}, 1000);

// Handle user registration form submit
document
  .getElementById("registerForm")
  .addEventListener("submit", async (e) => {
    e.preventDefault();

    const buttonImg = document.querySelector('.register-button img');
    const animation = document.getElementById('registration_animation');

    if (buttonImg && animation) {
      buttonImg.style.display = 'none';
      animation.style.display = 'block';
    }

    const uid = document.getElementById("uid").dataset.value || "";
    const name = document.getElementById("name").value;
    const year_level = document.getElementById("year_level").value;
    const section = document.getElementById("section").value;
    const course = document.getElementById("course").value;

    const registerBtn = document.getElementById("registerBtn");
    registerBtn.disabled = true;

    try {
      const response = await fetch("/register-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ uid, name, year_level, section, course }),
      });

      const result = await response.text();
      document.getElementById("status").textContent = result;

      if (response.ok) {
        document.getElementById("registerForm").reset();
        document.getElementById("formContainer").classList.add("hidden");

        // Reset the status and uid messages
        const uidElem = document.getElementById("uid");
        const statusElem = document.getElementById("status");

        uidElem.textContent = "Click to scan tag";
        uidElem.removeAttribute("data-value");
        statusElem.textContent = "";

        statusElem.textContent = result;

        setTimeout(() => {
          statusElem.textContent = "";
        }, 3000);

        isScanning = false;

        document.getElementById("register_button").classList.remove("hidden");

        if (buttonImg && animation) {
          animation.style.display = 'none';
          buttonImg.style.display = 'block';
        }
      }
    } catch (error) {
      document.getElementById(
        "status"
      ).textContent = `Error registering UID: ${error.message}`;
    } finally {
      registerBtn.disabled = false;
    }
  });

// Handle book registration form submit
document.getElementById("bookForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const uid = document.getElementById("uid").dataset.value || "";
  const book_name = document.getElementById("book_name").value;
  const category = document.getElementById("category").value;
  const bookRegisterBtn = document.getElementById("bookRegisterBtn");

  bookRegisterBtn.disabled = true;

  try {
    const response = await fetch("/register-book", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ uid, book_name, category }),
    });

    const result = await response.text();
    document.getElementById("status").textContent = result;

    if (response.ok) {
      document.getElementById("bookForm").reset();
      document.getElementById("bookFormContainer").classList.add("hidden");
      document.getElementById("uid").textContent = "Waiting...";
      document.getElementById("uid").removeAttribute("data-value");
      isBookScanning = false;
      document.getElementById("registerbook_button").classList.remove("hidden");
    }
  } catch (error) {
    document.getElementById(
      "status"
    ).textContent = `Error registering book: ${error.message}`;
  } finally {
    bookRegisterBtn.disabled = false;
  }
});

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

