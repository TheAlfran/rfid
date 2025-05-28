let scanning = false;
const scannedBooks = [];
const userUID = sessionStorage.getItem("userUID");
const userName = sessionStorage.getItem("userName");

document.getElementById("userName").textContent = userName;

document.getElementById("scanBookBtn").addEventListener("click", async () => {
    if (scanning) return;

    scanning = true;
    document.getElementById("status").textContent = "Scanning books...";

    const pollInterval = setInterval(async () => {
        const res = await fetch('/scan-book'); // ✅ New endpoint
        const data = await res.json();

        if (data.uid && !scannedBooks.includes(data.uid)) {
            scannedBooks.push(data.uid);

            const title = data.name || await getBookTitle(data.uid);
            const li = document.createElement("li");
            li.textContent = `${title || 'Unknown Book'} (UID: ${data.uid})`;
            document.getElementById("bookList").appendChild(li);

            document.getElementById("borrowBtn").classList.remove("hidden");
            document.getElementById("status").textContent = "Book scanned.";
        }
    }, 1000);

    document.getElementById("stopScanBtn").addEventListener("click", () => {
        clearInterval(pollInterval);
        scanning = false;
        document.getElementById("status").textContent = "Stopped scanning.";
    }, { once: true });
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userUID, books: scannedBooks })
    });

    const text = await res.text();
    document.getElementById("status").textContent = text;

    // Clear UI
    scannedBooks.length = 0;
    document.getElementById("bookList").innerHTML = '';
    document.getElementById("borrowBtn").classList.add("hidden");
});
