// Modify your fetch calls to properly handle non-JSON responses
fetch("/transfer-money", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  })
  .then(async (response) => {
    const text = await response.text();
    try {
      return JSON.parse(text); // Try to parse as JSON
    } catch {
      throw new Error(`Server returned: ${text}`); // Throw error with server response
    }
  })
  .then(data => {
    // Handle successful response
  })
  .catch(error => {
    console.error("Transfer error:", error);
    showToast(error.message, "error");
  });