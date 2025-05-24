
# Book Scanning

A web-based system using RFID for easy book borrowing and returning. Users register by scanning their RFID card, then log in to access a dashboard where they can borrow or return books by scanning RFID tags. All data is stored and managed in Firebase Firestore for real-time tracking.


## Coding Structure

    1. User Registration

        • If the user is not yet registered, they will:
            • Scan their RFID card.
            • Fill up the registration form (name, year level, etc.).
            • Click Submit to save their details in Firestore.

```bash
void handleRegisterUser() {
  if (!server.hasArg("plain")) {
    server.send(400, "text/plain", "Missing request body");
    return;
  }

  String body = server.arg("plain");
  DynamicJsonDocument doc(1024);
  DeserializationError error = deserializeJson(doc, body);

  if (error) {
    server.send(400, "text/plain", "Invalid JSON");
    return;
  }

  String uid = doc["uid"] | "";
  String name = doc["name"] | "";
  String year_level = doc["year_level"] | "";
  String section = doc["section"] | "";
  String course = doc["course"] | "";

  if (uid == "") {
    server.send(400, "text/plain", "UID is required");
    return;
  }

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient https;

  String checkUrl = "https://firestore.googleapis.com/v1/projects/" + String(projectId) +
                    "/databases/(default)/documents/users/" + uid;

  https.begin(client, checkUrl);
  int checkCode = https.GET();
  https.end();

  if (checkCode == 200) {
    server.send(200, "text/plain", "UID already registered");
    return;
  }

  String registerUrl = checkUrl;
  String payload = "{ \"fields\": {"
                   "\"uid\": {\"stringValue\": \"" + uid + "\"},"
                   "\"name\": {\"stringValue\": \"" + name + "\"},"
                   "\"year_level\": {\"stringValue\": \"" + year_level + "\"},"
                   "\"section\": {\"stringValue\": \"" + section + "\"},"
                   "\"course\": {\"stringValue\": \"" + course + "\"}"
                   "} }";

  https.begin(client, registerUrl);
  https.addHeader("Content-Type", "application/json");

  int httpCode = https.PATCH(payload);
  String response = https.getString();
  https.end();

  if (httpCode == 200) {
    scannedUID = "";
    newUIDScanned = false;

    server.send(200, "text/plain", "User registered successfully!");
  } else {
    server.send(500, "text/plain", "Failed to register user. HTTP Code: " + String(httpCode) + ", Response: " + response);
  }
}
```

    2. User Login

        • User clicks the Login button.
        • Click the RFID icon and scan their RFID card.
        • If the card matches a registered user, they will be redirected to the Dashboard.
```bash
        if (isLoginScanning) {
            isLoginScanning = false;
            uidElem.textContent = `UID: ${data.uid} — Logging in`;

            if (data.registered) {
                statusElem.textContent = "Login successful. Redirecting...";
                setTimeout(() => {
                    sessionStorage.setItem("userUID", data.uid);
                    window.location.href = "/dashboard";
                }, 1500);
            }else {
                statusElem.textContent = "RFID not registered. Access denied.";
                setTimeout(() => {
                    uidElem.textContent = 'Please select an action';
                    uidElem.removeAttribute('data-value');
                    statusElem.textContent = '';
                }, 3000);
            }

            formContainer.classList.add('hidden');
            bookFormContainer.classList.add('hidden');
            return;
        }
```

    3.Dashboard - Borrowing Books

        • User clicks the Borrow tab.
        • Clicks the Scan Books button.
        • Starts scanning book RFID stickers (1 book every 3 seconds).
        • Scanned books are listed and stored as borrowed in the user's Firestore record.
```bash
document.getElementById("scanBookBtn").addEventListener("click", async () => {
    document.getElementById("status").textContent = "Scanning book...";

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

            const title = await getBookTitle(data.uid);
            const li = document.createElement("li");
            li.textContent = `${title || 'Unknown Book'} (UID: ${data.uid})`;
            document.getElementById("bookList").appendChild(li);

            document.getElementById("borrowBtn").classList.remove("hidden");
            document.getElementById("status").textContent = "Book scanned.";
        }
    }, 1000);
});
```

    4.Dashboard - Returning Books

        • User clicks the Return tab.
        • Clicks the Scan to Return button.
        • Starts scanning previously borrowed books (1 book every 3 seconds).
        • Scanned books are marked as returned in the Firestore record.
```bash
document.getElementById("scanReturnBtn").addEventListener("click", async () => {
    document.getElementById("returnStatus").textContent = "Scanning book for return...";

    await fetch('/clear-uid');
    await fetch('/start-scan');

    const pollInterval = setInterval(async () => {
        const res = await fetch('/uid?type=book');
        const data = await res.json();

        if (data.uid) {
            clearInterval(pollInterval);

            if (returnedBooks.includes(data.uid)) {
                document.getElementById("returnStatus").textContent = "Book already returned.";
                return;
            }

            returnedBooks.push(data.uid);

            const title = await getBookTitle(data.uid);
            const li = document.createElement("li");
            li.textContent = `${title || 'Unknown Book'} (UID: ${data.uid})`;
            document.getElementById("returnedBookList").appendChild(li);

            document.getElementById("returnBtn").classList.remove("hidden");
            document.getElementById("returnStatus").textContent = "Book ready to return.";
        }
    }, 1000);
});
```
    5. Logout

        • User can click the Logout button to end the session and return to the login screen.
```bash
document.getElementById("logoutBtn").addEventListener("click", () => {
    sessionStorage.clear();
    localStorage.clear();

    window.location.href = "/login.html";
});

```

    6. Registering book

        • Scan special RFID card → Scan book RFID sticker → Enter book title → Submit.
```bash
document.getElementById('bookForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const uid = document.getElementById('uid').dataset.value || '';
  const book_name = document.getElementById('book_name').value;
  const bookRegisterBtn = document.getElementById('bookRegisterBtn');

  bookRegisterBtn.disabled = true;

    try {
        const response = await fetch('/register-book', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ uid, book_name })
        });

        const result = await response.text();
        document.getElementById('status').textContent = result;

        if (response.ok) {
            document.getElementById('bookForm').reset();
            document.getElementById('bookFormContainer').classList.add('hidden');
            document.getElementById('uid').textContent = 'Waiting...';
            document.getElementById('uid').removeAttribute('data-value');
            isBookScanning = false;
            }
    } catch (error) {
        document.getElementById('status').textContent = `Error registering book: ${error.message}`;
    } finally {
        bookRegisterBtn.disabled = false;
  }
});
```