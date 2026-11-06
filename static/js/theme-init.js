// Runs before first paint so a light-theme user never sees a dark flash.
document.documentElement.setAttribute("data-bs-theme", localStorage.getItem("sq-theme") || "dark");
