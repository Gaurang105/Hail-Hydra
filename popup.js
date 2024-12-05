import { config } from './config.js';
import { calculateReminderInterval } from './utils.js';

document.addEventListener('DOMContentLoaded', function() {
    function updateNextReminderTime() {
        chrome.alarms.get('hydrationReminder', (alarm) => {
            const nextReminderElement = document.getElementById('next-reminder');    
            if (!alarm) {
                nextReminderElement.textContent = 'No active reminders';
                return;
            }
            function updateCountdown() {
                const now = new Date().getTime();
                const timeUntil = alarm.scheduledTime - now;
    
                if (timeUntil <= 0) {
                    nextReminderElement.textContent = 'Reminder due now!';
                    return;
                }
                const hours = Math.floor(timeUntil / (1000 * 60 * 60));
                const minutes = Math.floor((timeUntil % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((timeUntil % (1000 * 60)) / 1000);
                let countdownText = '';
                if (hours > 0) {
                    countdownText += `${hours}h `;
                }
                if (minutes > 0 || hours > 0) {
                    countdownText += `${minutes}m `;
                }
                countdownText += `${seconds}s`;
    
                nextReminderElement.textContent = countdownText;
            }
            updateCountdown();
            setInterval(updateCountdown, 1000);
        });
    }
    updateNextReminderTime();

    chrome.storage.sync.get([
        'weight',
        'height',
        'activity',
        'glassesConsumed',
        'targetGlasses',
        'lastResetDate'
    ], function(data) {
        if (data.weight) document.getElementById('weight').value = data.weight;
        if (data.height) document.getElementById('height').value = data.height;
        if (data.activity) document.getElementById('activity').value = data.activity;

        const today = new Date().toDateString();
        if (data.lastResetDate !== today) {
            chrome.storage.sync.set({
                glassesConsumed: 0,
                lastResetDate: today
            });
            data.glassesConsumed = 0;
        }

        updateGlassesDisplay(data.glassesConsumed || 0, data.targetGlasses || 0);
        if (data.weight) updateRecommendation();
    });

    document.getElementById('save').addEventListener('click', function() {
        this.classList.add('button-click');
        setTimeout(() => this.classList.remove('button-click'), 200);
        const settings = {
            weight: parseFloat(document.getElementById('weight').value),
            height: parseFloat(document.getElementById('height').value),
            activity: document.getElementById('activity').value
        };

        chrome.storage.sync.set(settings, function() {
            updateRecommendation();
        });
    });

    document.getElementById('add-glass').addEventListener('click', function() {
        this.classList.add('button-click');
        setTimeout(() => this.classList.remove('button-click'), 200);
        chrome.storage.sync.get(['glassesConsumed', 'targetGlasses'], function(data) {
            const newCount = (data.glassesConsumed || 0) + 1;
            chrome.storage.sync.set({ glassesConsumed: newCount }, function() {
                updateGlassesDisplay(newCount, data.targetGlasses || 0);
                const newInterval = calculateReminderInterval(
                    data.targetGlasses || 0,
                    newCount
                );
                if (newInterval > 0) {
                    chrome.alarms.clear('hydrationReminder', () => {
                        chrome.alarms.create('hydrationReminder', {
                            periodInMinutes: newInterval
                        });
                    });
                }
            });
        });
    });
    

    document.getElementById('reset-glasses').addEventListener('click', function() {
        this.classList.add('button-click');
        setTimeout(() => this.classList.remove('button-click'), 200);
        chrome.storage.sync.set({ glassesConsumed: 0 }, function() {
            chrome.storage.sync.get(['targetGlasses'], function(data) {
                updateGlassesDisplay(0, data.targetGlasses || 0);
                const newInterval = calculateReminderInterval(
                    data.targetGlasses || 0,
                    0
                );
                if (newInterval > 0) {
                    chrome.alarms.clear('hydrationReminder', () => {
                        chrome.alarms.create('hydrationReminder', {
                            periodInMinutes: newInterval
                        });
                    });
                }
            });
        });
    });
    

    function updateGlassesDisplay(consumed, target) {
        const glassesText = `Glasses drunk today: ${consumed} of ${target}`;
        document.getElementById('glasses-count').textContent = glassesText;
        
        const progressPercentage = target > 0 ? (consumed / target) * 100 : 0;
        const progressElement = document.getElementById('progress-fill');
        progressElement.style.transition = 'width 0.5s ease-in-out';
        progressElement.style.width = `${Math.min(100, progressPercentage)}%`;

        if (progressPercentage >= 100) {
            progressElement.style.background = 'linear-gradient(90deg, #2ecc71, #27ae60)';
        } else if (progressPercentage >= 75) {
            progressElement.style.background = 'linear-gradient(90deg, #3498db, #2980b9)';
        } else {
            progressElement.style.background = 'linear-gradient(90deg, #3498db, #2ecc71)';
        }
    }

    function updateRecommendation() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(position => {
                const latitude = position.coords.latitude;
                const longitude = position.coords.longitude;

                fetch(`http://api.weatherapi.com/v1/current.json?key=${config.WEATHER_API_KEY}&q=${latitude},${longitude}`)
                    .then(response => response.json())
                    .then(weatherData => {
                        const temp = weatherData.current.temp_c;
                        const humidity = weatherData.current.humidity;
                        
                        const weight = parseFloat(document.getElementById('weight').value);
                        let baseIntake = weight * 0.03;

                        const activityLevel = document.getElementById('activity').value;
                        const activityMultipliers = {
                            sedentary: 1,
                            light: 1.2,
                            moderate: 1.4,
                            high: 1.6
                        };
                        baseIntake *= activityMultipliers[activityLevel];

                        if (temp > 25) {
                            baseIntake *= 1 + ((temp - 25) * 0.02);
                        }
                        if (humidity > 60) {
                            baseIntake *= 1 + ((humidity - 60) * 0.005);
                        }

                        const targetGlasses = Math.ceil(baseIntake * 1000 / 250);

                        const recommendationElement = document.getElementById('water-recommendation');
                        const weatherElement = document.getElementById('weather-info');

                        recommendationElement.style.opacity = '0';
                        weatherElement.style.opacity = '0';

                        setTimeout(() => {
                            recommendationElement.textContent = 
                                `Recommended water intake: ${baseIntake.toFixed(2)} liters per day (${targetGlasses} glasses)`;
                            weatherElement.textContent = 
                                `Current conditions: ${temp}°C, ${humidity}% humidity`;
                            
                            recommendationElement.style.opacity = '1';
                            weatherElement.style.opacity = '1';
                        }, 200);

                        chrome.storage.sync.set({ 
                            currentRecommendation: baseIntake,
                            targetGlasses: targetGlasses,
                            lastWeatherUpdate: new Date().getTime()
                        });

                        chrome.storage.sync.get(['glassesConsumed'], function(data) {
                            updateGlassesDisplay(data.glassesConsumed || 0, targetGlasses);
                        });
                    })
                    .catch(error => {
                        console.error('Error fetching weather data:', error);
                        document.getElementById('weather-info').textContent = 
                            'Error fetching weather data. Using base recommendations.';
                    });
            });
        }
    }
});