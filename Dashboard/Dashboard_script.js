

var swiper = new Swiper('.swiper', {
    loop: true,
    speed: 1000, // Transition speed in milliseconds (1 second)
    navigation: {
        nextEl: '.swiper-button-next',
        prevEl: '.swiper-button-prev',
    },
    pagination: {
        el: '.swiper-pagination',
        clickable: true,
    },
});

document.getElementById("from-date").addEventListener("change", function() {
    let fromDate = this.value;
    document.getElementById("to-date").setAttribute("min", fromDate);
});

document.getElementById("to-date").addEventListener("change", function() {
    let toDate = this.value;
    document.getElementById("from-date").setAttribute("max", toDate);
});

// Select all date inputs
const fromDateInputs = document.querySelectorAll("#from-date");
const toDateInputs = document.querySelectorAll("#to-date");

// Function to synchronize date selection
function syncDateInputs(inputArray, newValue) {
    inputArray.forEach(input => {
        input.value = newValue;
    });
}

// Event listener for "From Date" picker
fromDateInputs.forEach(input => {
    input.addEventListener("change", function () {
        syncDateInputs(fromDateInputs, this.value);
        toDateInputs.forEach(input => input.setAttribute("min", this.value));
    });
});

// Event listener for "To Date" picker
toDateInputs.forEach(input => {
    input.addEventListener("change", function () {
        syncDateInputs(toDateInputs, this.value);
        fromDateInputs.forEach(input => input.setAttribute("max", this.value));
    });
});

function navigateTo(page) {
    document.body.classList.add("fade-out"); // Apply fade-out animation
    setTimeout(() => {
        window.location.href = page; // Redirect after animation
    }, 400); // Match animation duration
}