const scannedBooks = new Set();
const userUID = sessionStorage.getItem("userUID"); // Store this during login
const userName = sessionStorage.getItem("userName");
const returnScannedBooks = new Set();
const returnScanBtn = document.getElementById("returnScanBookButton");


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

  const books = [];
  for (const bookUID of scannedBooks) {
    const res = await fetch(`/book-info?uid=${bookUID}`);
    if (res.ok) {
      const book = await res.json();
      books.push({
        uid: bookUID,
        name: book.book_name || "Unknown"
      });
    }
  }

  const res = await fetch("/borrow-books", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userUID,
      books,
      dateToReturn: borrowDate,
    }),
  });

  const text = await res.text();
  showStatusMessage(text);

  scannedBooks.clear();
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

function showReturnStatus(message, duration = 3000) {
  const statusEl = document.getElementById("return_status");
  statusEl.textContent = message;
  if (duration > 0) {
    setTimeout(() => {
      statusEl.textContent = "Click to start scanning";
    }, duration);
  }
}

returnScanBtn.addEventListener("click", async () => {
  if (isScanning) return;
  isScanning = true;
  returnScanBtn.disabled = true;
  document.getElementById("return_status").textContent = "Scanning book...";

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
      returnScanBtn.disabled = false;
      document.getElementById("return_status").textContent = "Click to start scanning";

      // Prevent duplicates
      if (returnScannedBooks.has(data.uid)) {
        showReturnStatus("Book already scanned for return.", 3000);
        return;
      }

      const isBorrowedByUser = await checkIfUserHasBook(data.uid);
      if (!isBorrowedByUser) {
        showReturnStatus("This book is not borrowed by you.", 3000);
        return;
      }

      const title = await getBookTitle(data.uid);
      const li = document.createElement("li");
      li.textContent = `${title} (UID: ${data.uid})`;
      document.getElementById("borrowedBooksList").appendChild(li);

      returnScannedBooks.add(data.uid);
      showReturnStatus("Book ready for return.", 2000);
    }
  }, 1000);
});


async function checkIfUserHasBook(bookUID) {
  const res = await fetch(`/user-info?uid=${userUID}`);
  if (!res.ok) return false;

  const data = await res.json();
  const borrowedBooks = data.borrowed_books || [];

  return borrowedBooks.some(book => book.uid === bookUID);
}

function showStatusMessage(message, timeout = 3000) {
  const statusElement = document.getElementById("status");
  const originalText = statusElement.textContent;
  statusElement.textContent = message;
  setTimeout(() => {
    if (!isScanning) {
      statusElement.textContent = "Click to start scanning";
    }
  }, timeout);
}


document.getElementById("returnBtn").addEventListener("click", async () => {
  if (!userUID || returnScannedBooks.size === 0) {
    showReturnStatus("No books selected for return.", 3000);
    return;
  }

  const res = await fetch("/return-books", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userUID,
      books: Array.from(returnScannedBooks),
    }),
  });

  const text = await res.text();
  showReturnStatus(text);

  returnScannedBooks.clear();
  document.getElementById("borrowedBooksList").innerHTML = "";
});



