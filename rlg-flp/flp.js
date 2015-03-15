var FLP;
(function (FLP) {
	var init = function() {				
		var $flpFPS = $('#flp-fps');
		var $flpLag = $('#flp-lag');
		var $flpPL = $('#flp-pl');
		var $flpTooltip = $('#flp-tooltip');
			
		var displayUpdate = function () {
			var currentFPS = Math.round(cuAPI.fps || 0);
			var currentLag = Math.round(cuAPI.netstats_lag || 0);
			var currentPacketLoss = "";
			var HueChange = 0;

			if (currentFPS < 10) {
				HueChange = 120;
			} else if (currentFPS > 10 && currentFPS < 30) {
				HueChange = ((30 - currentFPS) * 6);
			} else {
				HueChange = 0;
			}
			HueChange = 360 - HueChange;
			$flpFPS.css({
				'-webkit-filter' : 'hue-rotate('+HueChange+'deg)',
				'filter' : 'hue-rotate('+HueChange+'deg)'
			});
					
			HueChange = 0;
			if (currentLag > 150) {
				HueChange = 120;
			} else if (currentLag > 50 && currentLag < 150) {
				HueChange = Math.round(((currentLag - 50) * 1.2));
			} else {
				HueChange = 0;
			}				
			HueChange = 360 - HueChange;
				
			$flpLag.css({
				'-webkit-filter' : 'hue-rotate('+HueChange+'deg)',
				'filter' : 'hue-rotate('+HueChange+'deg)'
			});								
			HueChange = 360 - HueChange;
				
			$flpPL.css({
				'-webkit-filter' : 'brightness(0.25)',
				'filter' : 'brightness(0.25)'
			});

			$flpTooltip.html("FPS: "+ currentFPS + "</br>Lag: " + currentLag + "</br>PL: ---");
			setTimeout(displayUpdate, 5000);
		}
		displayUpdate();
			
		var DELAY = 700, clicks = 0, timer = null;
		$("#flp-fps, #flp-lag, #flp-pl").on("click", function(e){
			clicks++;
			if(clicks === 1) {
				timer = setTimeout(function() {
					$flpTooltip.css({					
						'opacity' : '1'
					});
					clicks = 0;	
				}, DELAY);
			} else {
				clearTimeout(timer);
					$flpTooltip.css({
						'opacity' : '0'
					});
				clicks = 0;
			}
		})
		.on("dblclick", function(e){
			e.preventDefault();
		});
	};
	if (typeof cuAPI !== "undefined") { 
		if (cuAPI.initialized) {  // cuAPI already initialised
			init();
		} else {
			cuAPI.OnInitialized(init);
		}
	}
})(FLP || (FLP = {}));
