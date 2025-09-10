<?php
// Empêche PHP d'afficher des erreurs HTML qui pourraient casser la réponse JSON
error_reporting(0);
@ini_set('display_errors', 0);

header("Content-Type: application/json; charset=UTF-8");

// Sécurité minimale : autoriser uniquement POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["status" => "error", "message" => "Méthode non autorisée"]);
    exit;
}

// Vérifier si le dossier "images" existe, sinon le créer
$uploadDir = 'images/';
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

// Définir les types de fichiers autorisés (MIME types)
$allowedMimeTypes = ['image/jpeg', 'image/png'];
$finfo = finfo_open(FILEINFO_MIME_TYPE);

// Gérer les fichiers uploadés
foreach ($_FILES as $key => $file) {
    if ($file['error'] === UPLOAD_ERR_OK) {
        $tempFilePath = $file['tmp_name'];
        $detectedMimeType = finfo_file($finfo, $tempFilePath);

        if (in_array($detectedMimeType, $allowedMimeTypes)) {
            $original_filename = $key;
            $last_underscore_pos = strrpos($original_filename, '_');
            if ($last_underscore_pos !== false) {
                $original_filename = substr_replace($original_filename, '.', $last_underscore_pos, 1);
            }
            
            $uploadFilePath = $uploadDir . basename($original_filename);

            // --- DÉBUT DE LA NOUVELLE SECTION DE RECADRAGE CENTRÉ ---

            // 1. Définir la taille finale et la qualité
            $finalSize = 500;
            $jpegQuality = 75;
            $pngCompression = 6;

            // 2. Obtenir les dimensions originales
            list($originalWidth, $originalHeight) = getimagesize($tempFilePath);

            // 3. Déterminer la zone de recadrage (le plus grand carré possible au centre)
            $cropSize = min($originalWidth, $originalHeight);
            $src_x = ($originalWidth - $cropSize) / 2;
            $src_y = ($originalHeight - $cropSize) / 2;

            // 4. Charger l'image source en mémoire
            if ($detectedMimeType == 'image/jpeg') {
                $sourceImage = imagecreatefromjpeg($tempFilePath);
            } else { // 'image/png'
                $sourceImage = imagecreatefrompng($tempFilePath);
            }

            // 5. Créer une nouvelle image carrée de destination
            $destImage = imagecreatetruecolor($finalSize, $finalSize);

            // Gérer la transparence pour les PNG
            if ($detectedMimeType == 'image/png') {
                imagealphablending($destImage, false);
                imagesavealpha($destImage, true);
                $transparent = imagecolorallocatealpha($destImage, 255, 255, 255, 127);
                imagefilledrectangle($destImage, 0, 0, $finalSize, $finalSize, $transparent);
            }

            // 6. Copier le carré central de l'image source dans l'image de destination
            imagecopyresampled(
                $destImage,     // Image de destination
                $sourceImage,     // Image source
                0, 0,             // Coordonnées de destination (coin supérieur gauche)
                $src_x, $src_y,   // Coordonnées de la source (pour centrer le carré)
                $finalSize, $finalSize, // Dimensions de destination (toujours 500x500)
                $cropSize, $cropSize   // Dimensions de la source (le carré découpé)
            );
            
            // 7. Sauvegarder la nouvelle image
            if ($detectedMimeType == 'image/jpeg') {
                imagejpeg($destImage, $uploadFilePath, $jpegQuality);
            } else {
                imagepng($destImage, $uploadFilePath, $pngCompression);
            }

            // 8. Libérer la mémoire
            imagedestroy($sourceImage);
            imagedestroy($destImage);
            
            // --- FIN DE LA SECTION DE RECADRAGE ---
        }
    }
}

finfo_close($finfo);

// Gérer les données JSON (partie inchangée)
if (isset($_POST['jsonData'])) {
    $json_data = json_decode($_POST['jsonData'], true);

    if ($json_data === null && json_last_error() !== JSON_ERROR_NONE) {
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "JSON invalide dans jsonData"]);
        exit;
    }
    
    $bytesWritten = @file_put_contents("datas/datas.json", json_encode($json_data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    
    if ($bytesWritten === false) {
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => "Échec de l'écriture dans le fichier datas.json. Vérifiez les permissions du dossier 'datas'."]);
        exit;
    }

    echo json_encode(["status" => "success", "message" => "Fichier et images mis à jour"]);
} else {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Données JSON manquantes"]);
    exit;
}
?>