// web/dice/js/main.js

window.onload = function() {
    if(!myId) { 
        location.href = '../index.html'; 
        return; 
    }
    loadComponents();
};