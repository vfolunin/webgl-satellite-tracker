<?php
    function addData($jsFile, $url) {
        echo($url . "<br>");
        flush();
        
        $data = null;
        while (!$data)
            $data = file($url);
        
        $dataLen = count($data);
        for ($i = 0; $i < $dataLen && $i < 30; $i += 3) {
            $satName = trim($data[$i]);
            if ($satName[strlen($satName) - 1] == ']')
                $satName = substr($satName, 0, strpos($satName, '['));
            fwrite($jsFile, str_replace("\r\n", "", "\t[\"" . $satName  . "\", \"" .  $data[$i + 1] . "\", \"" .  $data[$i + 2] . "\"],\n"));     
        }
    }
    
    ini_set("default_socket_timeout", 1);
    
    $groups = array(
        "amateur", "argos", "beidou", "cubesat", "dmc", "education", "engineering", "eutelsat", "galileo", "geo",
        "geodetic", "glo-ops", "globalstar", "gnss", "goes", "gorizont", "gps-ops", "hulianwang", "intelsat", "iridium-NEXT",
        "kuiper", "military", "molniya", "musson", "nnss", "noaa", "oneweb", "orbcomm", "other", "other-comm",
        "planet", "qianfan", "radar", "raduga", "resource", "sarsat", "satnogs", "sbas", "science", "ses", "spire",
        "starlink", "stations", "tdrss", "telesat", "weather", "x-comm"
    );

    $tleFile = fopen("tle.js", "w");
    fwrite($tleFile, "var tle = [\n");
    foreach($groups as $group)
        addData($tleFile, "https://celestrak.org/NORAD/elements/gp.php?GROUP=$group&FORMAT=tle");
    fwrite($tleFile, "];");
    fclose($tleFile);
?>