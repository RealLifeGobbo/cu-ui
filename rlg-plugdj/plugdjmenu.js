var PlugDJMenu;
(function (PlugDJMenu) {
	var DELAY = 700, clicks = 0, timer = null;
    $("#plugDJButton").on("click", function(e){
        clicks++;
        if(clicks === 1) {
            timer = setTimeout(function() {
				cuAPI.OpenUI('rlg-plugdj-web.ui');
                clicks = 0;				
            }, DELAY);
        } else {
            clearTimeout(timer);
			cuAPI.HideUI('rlg-plugdj-web');
            clicks = 0;
        }
    })
    .on("dblclick", function(e){
        e.preventDefault();
    });
})(PlugDJMenu || (PlugDJMenu = {}));
