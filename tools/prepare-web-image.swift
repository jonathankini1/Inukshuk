import Foundation
import ImageIO
import UniformTypeIdentifiers

guard CommandLine.arguments.count == 3 else {
    fputs("Usage: prepare-web-image <input> <output>\n", stderr)
    exit(64)
}

let inputURL = URL(fileURLWithPath: CommandLine.arguments[1])
let outputURL = URL(fileURLWithPath: CommandLine.arguments[2])

guard let source = CGImageSourceCreateWithURL(inputURL as CFURL, nil) else {
    fputs("Could not read input image\n", stderr)
    exit(1)
}

let thumbnailOptions: [CFString: Any] = [
    kCGImageSourceCreateThumbnailFromImageAlways: true,
    kCGImageSourceCreateThumbnailWithTransform: true,
    kCGImageSourceThumbnailMaxPixelSize: 2000,
    kCGImageSourceShouldCacheImmediately: true,
]

guard let image = CGImageSourceCreateThumbnailAtIndex(
    source,
    0,
    thumbnailOptions as CFDictionary
) else {
    fputs("Could not decode input image\n", stderr)
    exit(1)
}

guard let destination = CGImageDestinationCreateWithURL(
    outputURL as CFURL,
    UTType.jpeg.identifier as CFString,
    1,
    nil
) else {
    fputs("Could not create output image\n", stderr)
    exit(1)
}

let outputOptions: [CFString: Any] = [
    kCGImageDestinationLossyCompressionQuality: 0.82,
]
CGImageDestinationAddImage(destination, image, outputOptions as CFDictionary)

guard CGImageDestinationFinalize(destination) else {
    fputs("Could not write output image\n", stderr)
    exit(1)
}
