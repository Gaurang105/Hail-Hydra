import { config } from './config.js';
import { calculateReminderInterval } from './utils.js';

chrome.alarms.create('weatherUpdate', {
    periodInMinutes: 30
  });

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'hydrationReminder') {
      chrome.storage.sync.get([
        'currentRecommendation',
        'glassesConsumed',
        'targetGlasses'
      ], function(data) {
        const consumed = data.glassesConsumed || 0;
        const target = data.targetGlasses || 0;

        if (consumed >= target) {
          return;
        }
  
        const reminderUrl = chrome.runtime.getURL('reminder.html');

        chrome.storage.local.set({
          reminderData: {
            recommendation: data.currentRecommendation,
            glassesConsumed: consumed,
            targetGlasses: target
          }
        }, function() {
          chrome.windows.getCurrent({}, function(currentWindow) {
            const width = 400;
            const height = 500;
            const left = Math.round((currentWindow.width - width) / 2);
            const top = Math.round((currentWindow.height - height) / 2);
            
            chrome.windows.create({
              url: reminderUrl,
              type: 'popup',
              width: width,
              height: height,
              left: left + currentWindow.left,
              top: top + currentWindow.top,
              focused: true,
              state: 'normal'
            });
          });
        });

        const messages = [
          `Time for glass ${consumed + 1} of ${target}! 💧`,
          `${target - consumed} more glasses to go! 🌊`,
          `Stay on track! Glass ${consumed + 1} of ${target} 🚰`,
          `Ready for glass ${consumed + 1}? ${target - consumed} more to reach your goal! 💦`
        ];
        
        const notification = {
          type: 'basic',
          iconUrl: 'icons/icon128.png',
          title: 'Hydration Helper',
          message: messages[Math.floor(Math.random() * messages.length)]
        };
  
        chrome.notifications.create('hydrationReminder', notification);

        const newInterval = calculateReminderInterval(target, consumed + 1);
        if (newInterval > 0) {
          chrome.alarms.create('hydrationReminder', {
            periodInMinutes: 1
          });
        }
      });
    }
    else if (alarm.name === 'weatherUpdate') {
      updateWeatherBasedRecommendation();
    }
  });

  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync' && (changes.targetGlasses || changes.glassesConsumed)) {
      chrome.storage.sync.get(['targetGlasses', 'glassesConsumed'], function(data) {
        const interval = calculateReminderInterval(
          data.targetGlasses || 0,
          data.glassesConsumed || 0
        );
        
        if (interval > 0) {
          chrome.alarms.clear('hydrationReminder', () => {
            chrome.alarms.create('hydrationReminder', {
              periodInMinutes: interval
            });
          });
        }
      });
    }
  });
  
  function updateWeatherBasedRecommendation() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(position => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        
        fetch(`http://api.weatherapi.com/v1/current.json?key=${config.WEATHER_API_KEY}&q=${latitude},${longitude}`)
          .then(response => response.json())
          .then(weatherData => {
            chrome.storage.sync.get(['weight', 'activity'], function(data) {
              if (!data.weight) return;
  
              const temp = weatherData.current.temp_c;
              const humidity = weatherData.current.humidity;
              
              let baseIntake = data.weight * 0.03;
              
              const activityMultipliers = {
                sedentary: 1,
                light: 1.2,
                moderate: 1.4,
                high: 1.6
              };
              baseIntake *= activityMultipliers[data.activity || 'sedentary'];
  
              if (temp > 25) {
                baseIntake *= 1 + ((temp - 25) * 0.02);
              }
              if (humidity > 60) {
                baseIntake *= 1 + ((humidity - 60) * 0.005);
              }
  
              const targetGlasses = Math.ceil(baseIntake * 1000 / 250);
  
              chrome.storage.sync.set({ 
                currentRecommendation: baseIntake,
                targetGlasses: targetGlasses,
                lastWeatherUpdate: new Date().getTime()
              }, function() {
                chrome.storage.sync.get(['glassesConsumed'], function(data) {
                  const interval = calculateReminderInterval(targetGlasses, data.glassesConsumed || 0);
                  if (interval > 0) {
                    chrome.alarms.create('hydrationReminder', {
                      periodInMinutes: interval
                    });
                  }
                });
              });
            });
          })
          .catch(error => {
            console.error('Error fetching weather data:', error);
          });
      });
    }
  }

  updateWeatherBasedRecommendation();
  
  chrome.storage.sync.get(['targetGlasses', 'glassesConsumed'], function(data) {
    const interval = calculateReminderInterval(
      data.targetGlasses || 0,
      data.glassesConsumed || 0
    );
    if (interval > 0) {
      chrome.alarms.create('hydrationReminder', {
        periodInMinutes: interval
      });
    }
  });