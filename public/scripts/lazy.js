/*
 * Lazy image loading.
 */
document.addEventListener("DOMContentLoaded", function() {
    var lazyImages = [].slice.call(document.querySelectorAll("img.lazy-image"));

    if ("IntersectionObserver" in window) {
        var lazyImageObserver = new IntersectionObserver(function(entries, observer) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting) {
                    var lazyImage = entry.target;
                    if (lazyImage.dataset.src) {
                        lazyImage.src = lazyImage.dataset.src;
                        lazyImage.classList.remove("lazy-image");
                        lazyImageObserver.unobserve(lazyImage);
                    }
                }
            });
        });

        lazyImages.forEach(function(lazyImage) {
            lazyImageObserver.observe(lazyImage);
        });
    } else {
        // todo fallback
    }
});
