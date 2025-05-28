#include <WiFi.h>
#include <SPI.h>
#include <MFRC522.h>
#include <WebServer.h>
#include <FS.h>
#include <SPIFFS.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

#define RST_PIN 3
#define SS_PIN 22
#define SPI_CLK 19
#define SPI_MISO 25
#define SPI_MOSI 23
#define SPI_SS 22

const char *ssid = "Potatowifi";
const char *password = "%klsj3kljJkj12";
const char *projectId = "rfid-640be";

MFRC522 mfrc522(SS_PIN, RST_PIN);
WebServer server(80);

String scannedUID = "";
bool newUIDScanned = false;
unsigned long lastScanTime = 0;
const unsigned long scanCooldown = 5000;

bool scanRequested = false;
unsigned long scanStartTime = 0;
const unsigned long scanTimeout = 10000;

void handleFileRead(String path)
{
  if (path == "/")
    path = "/index.html";

  // If the path doesn't have a file extension, add .html
  if (!path.endsWith(".html") && !path.endsWith(".css") &&
      !path.endsWith(".js") && !path.endsWith(".json") &&
      !path.endsWith(".ico"))
  {
    path += ".html";
  }

  String contentType = "text/plain";
  if (path.endsWith(".html"))
    contentType = "text/html";
  else if (path.endsWith(".css"))
    contentType = "text/css";
  else if (path.endsWith(".js"))
    contentType = "application/javascript";
  else if (path.endsWith(".json"))
    contentType = "application/json";
  else if (path.endsWith(".ico"))
    contentType = "image/x-icon";

  if (SPIFFS.exists(path))
  {
    File file = SPIFFS.open(path, "r");
    server.streamFile(file, contentType);
    file.close();
  }
  else
  {
    server.send(404, "text/plain", "404: File Not Found");
  }
}

void handleUID()
{
  String type = server.arg("type");

  if (!newUIDScanned)
  {
    server.send(200, "application/json", "{\"uid\": \"\", \"registered\": false}");
    return;
  }

  String collection = (type == "book") ? "books" : "users";

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient https;

  String url = "https://firestore.googleapis.com/v1/projects/" + String(projectId) +
               "/databases/(default)/documents/" + collection + "/" + scannedUID;

  https.begin(client, url);
  int httpCode = https.GET();

  String jsonResponse;

  if (httpCode == 200) {
    // Parse JSON to get the name field
    String payload = https.getString();

    StaticJsonDocument<1024> doc;
    DeserializationError error = deserializeJson(doc, payload);

    if (!error) {
      // Firestore fields are nested under "fields"
      // and each field has a type key, e.g., stringValue
      const char* name = doc["fields"]["name"]["stringValue"] | "";

      jsonResponse = "{ \"uid\": \"" + scannedUID + "\", \"registered\": true, \"name\": \"" + String(name) + "\" }";
    } else {
      // JSON parse failed, fallback without name
      jsonResponse = "{ \"uid\": \"" + scannedUID + "\", \"registered\": true }";
    }
  } else {
    jsonResponse = "{ \"uid\": \"" + scannedUID + "\", \"registered\": false }";
  }

  https.end();
  server.send(200, "application/json", jsonResponse);
}

void handleSaveUID()
{
  if (!newUIDScanned)
  {
    server.send(400, "text/plain", "No UID to save");
    return;
  }

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient https;

  scannedUID.replace(" ", "");
  String url = "https://firestore.googleapis.com/v1/projects/" + String(projectId) + "/databases/(default)/documents/users/" + scannedUID;
  String payload = "{ \"fields\": { \"uid\": { \"stringValue\": \"" + scannedUID + "\" } } }";

  https.begin(client, url);
  https.addHeader("Content-Type", "application/json");
  int httpCode = https.PATCH(payload);
  https.end();

  if (httpCode == 200)
  {
    server.send(200, "text/plain", "UID saved to Firebase!");
  }
  else
  {
    server.send(500, "text/plain", "Failed to save UID");
  }

  newUIDScanned = false;
}

void handleRegisterUser()
{
  if (!server.hasArg("plain"))
  {
    server.send(400, "text/plain", "Missing request body");
    return;
  }

  String body = server.arg("plain");
  DynamicJsonDocument doc(1024);
  DeserializationError error = deserializeJson(doc, body);

  if (error)
  {
    server.send(400, "text/plain", "Invalid JSON");
    return;
  }

  String uid = doc["uid"] | "";
  String name = doc["name"] | "";
  String year_level = doc["year_level"] | "";
  String section = doc["section"] | "";
  String course = doc["course"] | "";

  if (uid == "")
  {
    server.send(400, "text/plain", "UID is required");
    return;
  }

  // Step 1: Check if UID already exists in Firebase
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient https;

  String checkUrl = "https://firestore.googleapis.com/v1/projects/" + String(projectId) +
                    "/databases/(default)/documents/users/" + uid;

  https.begin(client, checkUrl);
  int checkCode = https.GET();
  https.end();

  if (checkCode == 200)
  {
    server.send(200, "text/plain", "UID already registered");
    return;
  }

  // Step 2: Register new user
  String registerUrl = checkUrl;
  String payload = "{ \"fields\": {"
                   "\"uid\": {\"stringValue\": \"" +
                   uid + "\"},"
                         "\"name\": {\"stringValue\": \"" +
                   name + "\"},"
                          "\"year_level\": {\"stringValue\": \"" +
                   year_level + "\"},"
                                "\"section\": {\"stringValue\": \"" +
                   section + "\"},"
                             "\"course\": {\"stringValue\": \"" +
                   course + "\"}"
                            "} }";

  https.begin(client, registerUrl);
  https.addHeader("Content-Type", "application/json");

  int httpCode = https.PATCH(payload);
  String response = https.getString();
  https.end();

  if (httpCode == 200)
  {
    scannedUID = "";
    newUIDScanned = false;

    server.send(200, "text/plain", "User registered successfully!");
  }
  else
  {
    server.send(500, "text/plain", "Failed to register user. HTTP Code: " + String(httpCode) + ", Response: " + response);
  }
}

void setup()
{
  Serial.begin(115200);
  Serial.println("Server running on port 80");
  SPI.begin(SPI_CLK, SPI_MISO, SPI_MOSI, SPI_SS);
  mfrc522.PCD_Init();

  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED)
  {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nConnected! IP:");
  Serial.println(WiFi.localIP());

  if (!SPIFFS.begin(true))
  {
    Serial.println("SPIFFS mount failed");
    return;
  }

  server.on("/", []()
            { handleFileRead("/index.html"); });
  server.on("/uid", handleUID);
  server.on("/save-uid", handleSaveUID);
  server.on("/register-user", HTTP_POST, handleRegisterUser);
  server.on("/register-book", HTTP_POST, handleRegisterBook);
  server.on("/clear-uid", handleClearUID);
  server.on("/start-scan", handleStartScan);
  server.on("/book-info", HTTP_GET, handleBookInfo);
  server.on("/borrow-books", HTTP_POST, handleBorrowBooks);
  server.on("/scan-book", HTTP_GET, handleScanBook);
  server.onNotFound([]()
                    { handleFileRead(server.uri()); });

  server.begin();
}

void loop()
{
  server.handleClient();

  // Only scan when requested
  if (!scanRequested)
    return;

  // Stop if timeout reached
  if (millis() - scanStartTime > scanTimeout)
  {
    scanRequested = false;
    return;
  }

  if (!mfrc522.PICC_IsNewCardPresent() || !mfrc522.PICC_ReadCardSerial())
    return;

  if (millis() - lastScanTime < scanCooldown)
    return;

  lastScanTime = millis();
  scannedUID = ""; // clear previous UID

  for (byte i = 0; i < mfrc522.uid.size; i++)
  {
    if (mfrc522.uid.uidByte[i] < 0x10)
      scannedUID += "0";
    scannedUID += String(mfrc522.uid.uidByte[i], HEX);
  }
  scannedUID.toUpperCase();

  Serial.println("Scanned UID: " + scannedUID);
  newUIDScanned = true;
  scanRequested = false; // done scanning
}

void handleClearUID()
{
  scannedUID = "";
  newUIDScanned = false;
  server.send(200, "text/plain", "UID cleared");
}

void handleStartScan()
{
  scanRequested = true;
  scanStartTime = millis();
  scannedUID = "";
  newUIDScanned = false;
  server.send(200, "text/plain", "Scan started");
}

void handleRegisterBook()
{
  if (!server.hasArg("plain"))
  {
    server.send(400, "text/plain", "Missing request body");
    return;
  }

  String body = server.arg("plain");
  DynamicJsonDocument doc(512);
  DeserializationError error = deserializeJson(doc, body);

  if (error)
  {
    server.send(400, "text/plain", "Invalid JSON");
    return;
  }

  String uid = doc["uid"] | "";
  String book_name = doc["book_name"] | "";

  if (uid == "" || book_name == "")
  {
    server.send(400, "text/plain", "UID and Book Name are required");
    return;
  }

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient https;

  String url = "https://firestore.googleapis.com/v1/projects/" + String(projectId) +
               "/databases/(default)/documents/books/" + uid;

  // Add "borrowed": { "booleanValue": false } to the payload
  String payload = "{ \"fields\": {"
                   "\"uid\": {\"stringValue\": \"" +
                   uid + "\"},"
                         "\"book_name\": {\"stringValue\": \"" +
                   book_name + "\"},"
                               "\"borrowed\": {\"booleanValue\": false}"
                               "} }";

  https.begin(client, url);
  https.addHeader("Content-Type", "application/json");
  int httpCode = https.PATCH(payload);
  String response = https.getString();
  https.end();

  if (httpCode == 200)
  {
    scannedUID = "";
    newUIDScanned = false;
    server.send(200, "text/plain", "Book registered successfully!");
  }
  else
  {
    server.send(500, "text/plain", "Failed to register book. HTTP Code: " + String(httpCode) + ", Response: " + response);
  }
}

void handleBookInfo()
{
  if (!server.hasArg("uid"))
  {
    server.send(400, "application/json", "{\"error\": \"Missing UID\"}");
    return;
  }

  String uid = server.arg("uid");
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient https;

  String url = "https://firestore.googleapis.com/v1/projects/" + String(projectId) +
               "/databases/(default)/documents/books/" + uid;

  https.begin(client, url);
  int httpCode = https.GET();

  if (httpCode != 200)
  {
    server.send(404, "application/json", "{\"error\": \"Book not found\"}");
    https.end();
    return;
  }

  String payload = https.getString();
  https.end();

  // Parse title
  DynamicJsonDocument doc(1024);
  deserializeJson(doc, payload);

  String title = doc["fields"]["book_name"]["stringValue"] | "";
  String json = "{\"book_name\": \"" + title + "\"}";

  server.send(200, "application/json", json);
}

void handleBorrowBooks()
{
  if (server.method() != HTTP_POST)
  {
    server.send(405, "text/plain", "Method Not Allowed");
    return;
  }

  DynamicJsonDocument doc(2048);
  DeserializationError error = deserializeJson(doc, server.arg("plain"));

  if (error)
  {
    server.send(400, "text/plain", "Invalid JSON");
    return;
  }

  String userUID = doc["userUID"];
  JsonArray books = doc["books"].as<JsonArray>();

  // Construct Firestore array format
  String jsonBody = "{ \"fields\": { \"borrowed_books\": { \"arrayValue\": { \"values\": [";

  for (size_t i = 0; i < books.size(); i++)
  {
    jsonBody += "{ \"stringValue\": \"" + books[i].as<String>() + "\" }";
    if (i < books.size() - 1)
      jsonBody += ",";
  }

  jsonBody += "]}}}}";

  // PATCH to user doc
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient https;

  String url = "https://firestore.googleapis.com/v1/projects/" + String(projectId) +
               "/databases/(default)/documents/users/" + userUID + "?updateMask.fieldPaths=borrowed_books";

  https.begin(client, url);
  https.addHeader("Content-Type", "application/json");

  int httpCode = https.PATCH(jsonBody);
  String response = https.getString();
  https.end();

  if (httpCode == 200)
  {
    server.send(200, "text/plain", "Books borrowed successfully.");
  }
  else
  {
    server.send(500, "text/plain", "Failed to borrow books.");
  }
}

void handleScanBook()
{
  if (!newUIDScanned)
  {
    server.send(200, "application/json", "{\"uid\": \"\", \"registered\": false}");
    return;
  }

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient https;

  String url = "https://firestore.googleapis.com/v1/projects/" + String(projectId) +
               "/databases/(default)/documents/books/" + scannedUID;

  https.begin(client, url);
  int httpCode = https.GET();

  String jsonResponse;

  if (httpCode == 200)
  {
    String payload = https.getString();

    StaticJsonDocument<1024> doc;
    DeserializationError error = deserializeJson(doc, payload);

    if (!error)
    {
      const char* name = doc["fields"]["name"]["stringValue"] | "";
      jsonResponse = "{ \"uid\": \"" + scannedUID + "\", \"registered\": true, \"name\": \"" + String(name) + "\" }";
    }
    else
    {
      jsonResponse = "{ \"uid\": \"" + scannedUID + "\", \"registered\": true }";
    }
  }
  else
  {
    jsonResponse = "{ \"uid\": \"" + scannedUID + "\", \"registered\": false }";
  }

  https.end();
  server.send(200, "application/json", jsonResponse);

  // Reset UID and trigger next scan for books
  scannedUID = "";
  newUIDScanned = false;
  scanRequested = true;
  scanStartTime = millis(); // optional, to restart cooldown
}
