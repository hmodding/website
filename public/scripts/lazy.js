/* eslint-disable no-undef */
'use strict';

/**
 * Lazy image loading.
 * Taken from the Google Web Fundamentals, slightly modified:
 * https://developers.google.com/
 * web/fundamentals/performance/lazy-loading-guidance/images-and-video
 */
document.addEventListener('DOMContentLoaded', function() {
  var lazyImages = [].slice.call(document.querySelectorAll('img.lazy-image'));

  if ('IntersectionObserver' in window) {
    var lazyImageObserver = new IntersectionObserver(function(entries, obs) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          var lazyImage = entry.target;
          if (lazyImage.dataset.src) {
            lazyImage.src = lazyImage.dataset.src;
            lazyImage.classList.remove('lazy-image');
            lazyImageObserver.unobserve(lazyImage);
          }
        }
      });
    });

    lazyImages.forEach(function(lazyImage) {
      lazyImageObserver.observe(lazyImage);
    });
  } else {
    var active = false;
    var lazyLoad = function() {
      if (active === false) {
        active = true;

        setTimeout(function() {
          lazyImages.forEach(function(lazyImage) {
            var rect = lazyImage.getBoundingClientRect();
            if ((rect.top <= window.innerHeight && rect.bottom >= 0) &&
                getComputedStyle(lazyImage).display !== 'none') {
              lazyImage.src = lazyImage.dataset.src;
              lazyImage.classList.remove('lazy-image');

              lazyImages = lazyImages.filter(function(image) {
                return image !== lazyImage;
              });

              if (lazyImages.length === 0) {
                document.removeEventListener('scroll', lazyLoad);
                window.removeEventListener('resize', lazyLoad);
                window.removeEventListener('orientationchange', lazyLoad);
              }
            }
          });

          active = false;
        }, 200);
      }
    };

    document.addEventListener('scroll', lazyLoad);
    window.addEventListener('resize', lazyLoad);
    window.addEventListener('orientationchange', lazyLoad);
  }
});
