const scannedBooks = [];
const userUID = sessionStorage.getItem("userUID"); // Store this during login
const userName = sessionStorage.getItem("userName");

document.getElementById("userName").textContent = userName;

document.getElementById("scanBookBtn").addEventListener("click", async () => {
    document.getElementById("status").textContent = "Scanning book...";

    // Trigger scan
    await fetch('/clear-uid');
    await fetch('/start-scan');

    const pollInterval = setInterval(async () => {
    const res = await fetch('/uid?type=book');
    const data = await res.json();

    if (data.uid) {
        clearInterval(pollInterval);

        if (scannedBooks.includes(data.uid)) {
        document.getElementById("status").textContent = "Book already scanned.";
        return;
        }

        scannedBooks.push(data.uid);

        // Show title
        const title = await getBookTitle(data.uid);
        const li = document.createElement("li");
        li.textContent = `${title || 'Unknown Book'} (UID: ${data.uid})`;
        document.getElementById("bookList").appendChild(li);

        // Show borrow button
        document.getElementById("borrowBtn").classList.remove("hidden");
        document.getElementById("status").textContent = "Book scanned.";
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
    if (!userUID || scannedBooks.length === 0) return;

    const res = await fetch('/borrow-books', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ userUID, books: scannedBooks })
    });

    const text = await res.text();
    document.getElementById("status").textContent = text;

    // Clear UI
    scannedBooks.length = 0;
    document.getElementById("bookList").innerHTML = '';
    document.getElementById("borrowBtn").classList.add("hidden");
});