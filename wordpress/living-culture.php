<?php
/**
 * Plugin Name:       Living Culture
 * Description:       The Living Culture young adult Bible study site (notice board, calendar, prayer requests and Bible), served at yoursite.com/livingculture/.
 * Version:           1.0.0
 * Requires at least: 5.0
 * Requires PHP:      7.4
 * Author:            Living Culture
 * License:           GPL-2.0-or-later
 * Text Domain:       living-culture
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'LC_SITE_DIR', __DIR__ . '/site' );

/** The address the site lives at, e.g. "livingculture" → yoursite.com/livingculture/ */
function lc_slug() {
	$slug = strtolower( (string) get_option( 'lc_site_slug', 'livingculture' ) );
	$slug = trim( preg_replace( '~[^a-z0-9\-]~', '', $slug ), '-' );
	return '' === $slug ? 'livingculture' : $slug;
}

function lc_site_url() {
	return home_url( '/' . lc_slug() . '/' );
}

/**
 * Serve the Living Culture files for any request under /<slug>/.
 * The pages are complete HTML documents, so the WordPress theme does not touch them.
 */
function lc_serve() {
	if ( is_admin() || ( defined( 'REST_REQUEST' ) && REST_REQUEST ) ) {
		return;
	}

	$path = (string) parse_url( isset( $_SERVER['REQUEST_URI'] ) ? $_SERVER['REQUEST_URI'] : '', PHP_URL_PATH );
	$home = rtrim( (string) parse_url( home_url( '/' ), PHP_URL_PATH ), '/' );
	$base = $home . '/' . lc_slug();

	if ( $path === $base ) {
		wp_safe_redirect( $base . '/', 301 );
		exit;
	}
	if ( 0 !== strpos( $path, $base . '/' ) ) {
		return;
	}

	$rel = rawurldecode( substr( $path, strlen( $base ) + 1 ) );
	if ( '' === $rel || '/' === substr( $rel, -1 ) ) {
		$rel .= 'index.html';
	}

	$types = array(
		'html' => 'text/html; charset=utf-8',
		'css'  => 'text/css; charset=utf-8',
		'js'   => 'application/javascript; charset=utf-8',
		'jpg'  => 'image/jpeg',
		'jpeg' => 'image/jpeg',
		'png'  => 'image/png',
		'svg'  => 'image/svg+xml',
		'webp' => 'image/webp',
		'ico'  => 'image/x-icon',
	);

	$root = realpath( LC_SITE_DIR );
	$file = realpath( LC_SITE_DIR . '/' . $rel );
	$ext  = strtolower( (string) pathinfo( (string) $file, PATHINFO_EXTENSION ) );

	// Only real files inside the site folder with an allowed type; anything else falls through to WordPress (404).
	if ( ! $root || ! $file || 0 !== strpos( $file, $root . DIRECTORY_SEPARATOR ) || ! is_file( $file ) || ! isset( $types[ $ext ] ) ) {
		return;
	}

	status_header( 200 );
	header( 'Content-Type: ' . $types[ $ext ] );
	header( 'X-Content-Type-Options: nosniff' );
	header( 'Cache-Control: ' . ( 'html' === $ext ? 'no-cache' : 'public, max-age=3600' ) );
	header( 'Content-Length: ' . filesize( $file ) );
	readfile( $file );
	exit;
}
add_action( 'init', 'lc_serve', 0 );

/* ---------- Settings → Living Culture ---------- */

function lc_admin_menu() {
	add_options_page( 'Living Culture', 'Living Culture', 'manage_options', 'living-culture', 'lc_settings_page' );
}
add_action( 'admin_menu', 'lc_admin_menu' );

function lc_register_settings() {
	register_setting(
		'lc_settings',
		'lc_site_slug',
		array(
			'type'              => 'string',
			'default'           => 'livingculture',
			'sanitize_callback' => function ( $value ) {
				$value = trim( preg_replace( '~[^a-z0-9\-]~', '', strtolower( (string) $value ) ), '-' );
				return '' === $value ? 'livingculture' : $value;
			},
		)
	);
}
add_action( 'admin_init', 'lc_register_settings' );

function lc_settings_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	?>
	<div class="wrap">
		<h1>Living Culture</h1>
		<p>The Living Culture site is live at:
			<a href="<?php echo esc_url( lc_site_url() ); ?>" target="_blank" rel="noopener"><strong><?php echo esc_html( lc_site_url() ); ?></strong></a></p>
		<p>Leaders manage notices, the calendar, breaks and prayer requests at
			<a href="<?php echo esc_url( lc_site_url() . 'admin.html' ); ?>" target="_blank" rel="noopener"><?php echo esc_html( lc_site_url() . 'admin.html' ); ?></a>
			(this uses the Living Culture leader login, not your WordPress login).</p>
		<form method="post" action="options.php">
			<?php settings_fields( 'lc_settings' ); ?>
			<table class="form-table" role="presentation">
				<tr>
					<th scope="row"><label for="lc_site_slug">Address</label></th>
					<td>
						<code><?php echo esc_html( home_url( '/' ) ); ?></code>
						<input name="lc_site_slug" id="lc_site_slug" type="text" class="regular-text" value="<?php echo esc_attr( lc_slug() ); ?>">
						<code>/</code>
						<p class="description">Letters, numbers and dashes only. Don't use the address of an existing WordPress page.</p>
					</td>
				</tr>
			</table>
			<?php submit_button(); ?>
		</form>
	</div>
	<?php
}

function lc_action_links( $links ) {
	array_unshift( $links, '<a href="' . esc_url( lc_site_url() ) . '" target="_blank" rel="noopener">Open site</a>' );
	array_unshift( $links, '<a href="' . esc_url( admin_url( 'options-general.php?page=living-culture' ) ) . '">Settings</a>' );
	return $links;
}
add_filter( 'plugin_action_links_' . plugin_basename( __FILE__ ), 'lc_action_links' );
