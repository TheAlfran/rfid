const scannedBooks = new Set();
const userUID = sessionStorage.getItem("userUID"); // Store this during login
const userName = sessionStorage.getItem("userName");

console.log("User UID:", userUID);
console.log("User Name:", userName);

document.getElementById("userName").textContent = userName;

async function getBookInfo(uid) {
  const res = await fetch(`/book-info?uid=${uid}`);
  if (res.ok) {
    const data = await res.json();
    return {
      title: data.book_name || null,
      borrowed: data.borrowed || false,
    };
  }
  return null;
}

const scanBtn = document.getElementById("scanBookBtn");
let isScanning = false
scanBtn.addEventListener("click", async () => {
  if (isScanning) return; // Prevent double scan
  isScanning = true;
  scanBtn.disabled = true; // Optional: visually disable

  document.getElementById("status").textContent = "Scanning book...";

  await fetch("/clear-uid");
  await fetch("/start-scan");

  let lastUID = null;

  const pollInterval = setInterval(async () => {
    const res = await fetch("/uid?type=book");
    const data = await res.json();

    if (data.uid && data.uid !== lastUID) {
      lastUID = data.uid;
      clearInterval(pollInterval);
      isScanning = false;
      scanBtn.disabled = false;

      if (scannedBooks.has(data.uid)) {
        showStatusMessage("Book already scanned.", 3000);
        return;
      }

      const bookInfo = await getBookInfo(data.uid);
      if (!bookInfo) {
        showStatusMessage("Failed to get book info.", 3000);
        return;
      }

      if (bookInfo.borrowed) {
        showStatusMessage(`"${bookInfo.title}" is already borrowed. Please return it first.`, 3000);
        return;
      }

      scannedBooks.add(data.uid);

      const li = document.createElement("li");
      li.textContent = `${bookInfo.title} (UID: ${data.uid})`;
      document.getElementById("bookList").appendChild(li);

      document.getElementById("borrowBtn").classList.remove("hidden");
      showStatusMessage("Book scanned successfully.", 2000);
    }
  }, 1000);
});


async function getBookTitle(uid) {
  const res = await fetch(`/book-info?uid=${uid}`);
  if (res.ok) {
    const data = await res.json();
    return data.book_name || null;
  }
  return null;
}


document.getElementById("borrowBtn").addEventListener("click", async () => {
  const borrowDate = document.getElementById("borrowDate").value;

  if (!userUID || scannedBooks.size === 0 || !borrowDate) {
    showStatusMessage("Insufficient data.");
    return;
  }

  const res = await fetch("/borrow-books", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userUID,
      books: Array.from(scannedBooks),
      dateToReturn: borrowDate,
    }),
  });

  const text = await res.text();
  showStatusMessage(text);

  scannedBooks.length = 0;
  document.getElementById("bookList").innerHTML = "";
  document.getElementById("borrowBtn").classList.add("hidden");
  document.getElementById("borrowDate").value = "";
});

function showTab(event, tabId) {
  // Hide all tab contents
  document.querySelectorAll(".tab-content").forEach((content) => {
    content.classList.remove("active");
  });

  // Remove active class from all tab buttons
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.classList.remove("active");
  });

  // Show the selected tab and mark the button active
  document.getElementById(tabId).classList.add("active");
  event.target.classList.add("active");
}

function showStatusMessage(message, duration = 3000) {
  const statusEl = document.getElementById("status");
  statusEl.textContent = message;
  if (duration > 0) {
    setTimeout(() => {
      statusEl.textContent = "Click to start scanning";
    }, duration);
  }
}
