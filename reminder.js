document.addEventListener('DOMContentLoaded', function() {
    document.querySelector('.reminder-container').classList.add('fade-in');
    chrome.storage.local.get(['reminderData'], function(data) {
      if (data.reminderData) {
        const { recommendation, glassesConsumed, targetGlasses } = data.reminderData;
        const recommendationText = `Daily Goal: ${recommendation.toFixed(2)}L (${targetGlasses} glasses)`;
        document.getElementById('recommendation-text').textContent = recommendationText;
        updateProgress(glassesConsumed, targetGlasses);
      }
    });
  
    document.getElementById('add-glass').addEventListener('click', function() {
      this.classList.add('button-click');
      chrome.storage.sync.get(['glassesConsumed', 'targetGlasses'], function(data) {
        const newCount = (data.glassesConsumed || 0) + 1;
        chrome.storage.sync.set({ glassesConsumed: newCount }, function() {
          updateProgress(newCount, data.targetGlasses);
          document.querySelector('.reminder-container').classList.add('fade-out');
          setTimeout(() => {
            window.close();
          }, 1000);
        });
      });
    });
  
    document.getElementById('close-reminder').addEventListener('click', function() {
      document.querySelector('.reminder-container').classList.add('fade-out');
      setTimeout(() => {
        window.close();
      }, 500);
    });
  
    function updateProgress(consumed, target) {
      const progressText = `Glasses drunk today: ${consumed} of ${target}`;
      document.getElementById('progress-text').textContent = progressText;
      
      const progressPercentage = target > 0 ? (consumed / target) * 100 : 0;
      const progressElement = document.getElementById('progress-fill');
      progressElement.style.transition = 'width 0.5s ease-in-out';
      progressElement.style.width = `${Math.min(100, progressPercentage)}%`;
    }
  });