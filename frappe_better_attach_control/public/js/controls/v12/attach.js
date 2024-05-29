/*
*  Frappe Better Attach Control © 2024
*  Author:  Ameen Ahmed
*  Company: Level Up Marketing & Software Development Services
*  Licence: Please refer to LICENSE file
*/


import Helpers from './../../utils';
import Filetype from './../../filetypes';


frappe.ui.form.ControlAttach = frappe.ui.form.ControlAttach.extend({
    make: function() {
        this._super();
        this._setup_control();
    },
    make_input: function() {
        this._update_options();
        this._super();
        this._toggle_remove_button();
        this._setup_display();
    },
    clear_attachment: function() {
        if (!this._allow_remove) return;
        if (!this.frm) {
            if (!this._value.length) this._reset_input();
            else this._remove_files(this._value, function(ret) {
                if (cint(ret)) this._reset_input();
                else Helpers.error('Unable to clear the uploaded attachments.');
            });
            return;
        }
        // To prevent changing value from within set_input function
        this._prevent_input = true;
        if (!this._value.length) {
            this._reset_value();
            this.refresh();
            this._form_save();
            // To allow changing value from within set_input function
            this._prevent_input = false;
            return;
        }
        this._remove_files(this._value, function(ret) {
            if (!cint(ret)) return Helpers.error('Unable to clear the uploaded attachments.');
            if (this.frm.attachments)
                Helpers.each(this._value, function(v) {
                    var fid = this.frm.attachments.get_file_id_from_file_url(v);
                    if (fid) this.frm.attachments.remove_fileid(fid);
                }, this);
            
            this.frm.sidebar && this.frm.sidebar.reload_docinfo();
            try {
                this.parse_validate_and_set_in_model(null);
                this._reset_value();
                this.refresh();
                this._form_save();
                // To allow changing value from within set_input function
                this._prevent_input = false;
            } catch(_) {
                // To allow changing value from within set_input function
                this._prevent_input = false;
            }
        }, function() {
            // To allow changing value from within set_input function before failure
            this._prevent_input = false;
        });
    },
    on_attach_click: function() {
        this.set_upload_options();
        this.file_uploader = new frappe.ui.FileUploader(this.upload_options);
    },
    set_upload_options: function() {
        if (this.upload_options) return;
        this._update_options();
        var opts = this._options && this.df.options;
        if (opts) this.df.options = this._options;
        this._super();
        if (opts) this.df.options = opts;
        if (this._images_only) this._set_image_upload_options();
    },
    set_value: function(value, force_set_value) {
        // Prevent changing value if called from event
        if (this._prevent_input) return Promise.resolve();
        value = this._set_value(value);
        if (!this.frm) this._updating_input = true;
        return this._super(value, force_set_value || false);
    },
    set_input: function(value, dataurl) {
        // Prevent changing value if called from event
        if (this._prevent_input) return;
        if (this._updating_input) {
            this._updating_input = false;
            if (this._value.length) this._update_input();
            return;
        }
        if (value === null) {
            if (!this._value.length) this._reset_value();
            else this._remove_files(this._value, function(ret) {
                if (cint(ret)) this._reset_value();
                else Helpers.error('Unable to delete the uploaded attachments.');
            });
            return;
        }
        if (Helpers.isEmpty(value)) return;
        var val = Helpers.toArray(value, null);
        if (Helpers.isArray(val)) {
            if (!val.length) return;
            var update = 0;
            if (!this._allow_multiple) {
                value = val[0];
                if (Helpers.isString(value) && this._value.indexOf(value) < 0) {
                    this._set_value(value);
                    update = 1;
                }
            } else {
                Helpers.each(val, function(v) {
                    if (Helpers.isString(v) && this._value.indexOf(value) < 0) {
                        this._set_value(v);
                        update = 1;
                    }
                }, this);
            }
            if (update) this._update_input();
            this._multiple_values = false;
            this._process_files();
            return;
        }
        if (!Helpers.isString(value)) return;
        this.value = this._set_value(value);
        this._update_input(value, dataurl);
    },
    on_upload_complete: function(attachment) {
        if (this.frm) {
            this.parse_validate_and_set_in_model(attachment.file_url);
            this.frm.attachments && this.frm.attachments.update_attachment(attachment);
            if (!this._allow_multiple) this._form_save();
            else {
                var up = this.file_uploader && this.file_uploader.uploader;
                if (up && up.files && up.files.every(function(file) { return !file.failed; }))
                    this._form_save();
            }
        }
        this.set_input(attachment.file_url);
    },
    refresh: function() {
        this._super();
        if (Helpers.isString(this.df.options))
            this.df.options = Helpers.parseJson(this.df.options, {});
        if (!Helpers.isPlainObject(this.df.options)) this.df.options = {};
        if (!Helpers.isEqual(this.df.options, this._ls_options))
            this.set_options(this.df.options);
        this.set_input(Helpers.toArray(this.value));
    },
    // Custom Methods
    auto_save: function(enable) {
        this._disable_auto_save = enable ? false : true;
    },
    toggle_remove: function(allow) {
        if (allow != null) this._allow_remove = !!allow;
        else this._allow_remove = !this._allow_remove;
        this._toggle_remove_button();
    },
    set_options: function(opts) {
        if (Helpers.isString(opts) && opts.length) opts = Helpers.parseJson(opts, null);
        if (Helpers.isEmpty(opts) || !Helpers.isPlainObject(opts)) return;
        $.extend(true, this.df.options, opts);
        this._update_options();
    },
    // Private Methods
    _setup_control: function() {
        this._doctype = (this.frm && this.frm.doctype)
            || this.doctype
            || (this.doc && this.doc.doctype)
            || null;
        this._is_webform = (frappe.BAC && !!frappe.BAC.webform)
            || this._doctype === 'Web Form'
            || this.df.parenttype === 'Web Form'
            || this.df.is_web_form
            || (this.doc && this.doc.web_form_name);
        
        if (this._is_webform && frappe.BAC) {
            if (Helpers.isString(frappe.BAC.options))
                frappe.BAC.options = Helpers.parseJson(frappe.BAC.options, {});
            if (!Helpers.isPlainObject(frappe.BAC.options)) frappe.BAC.options = {};
            if (frappe.BAC.options[this.df.fieldname])
                this.df.options = frappe.BAC.options[this.df.fieldname];
        }
        
        this._ls_options = null;
        this._options = null;
        this._value = [];
        this._files = [];
        this._disable_auto_save = false;
        this._allow_multiple = false;
        this._max_attachments = {};
        this._allow_remove = true;
        this._display_ready = false;
        this._unprocessed_files = [];
        
        frappe.realtime.on(
            'better_attach_console',
            function(ret) { Helpers.log(ret); }
        );
        
        if (Helpers.isString(this.df.options))
            this.df.options = Helpers.parseJson(this.df.options, {});
        if (!Helpers.isPlainObject(this.df.options)) this.df.options = {};
    },
    _update_options: function() {
        this._ls_options = Helpers.deepClone(this.df.options);
        let opts;
        if (Helpers.isEmpty(this._ls_options)) opts = {};
        else opts = this._parse_options(this._ls_options);
        this._options = opts.options || null;
        this._reload_control(opts);
    },
    _parse_options: function(opts) {
        var tmp = {options: {restrictions: {}, extra: {}}};
        tmp.allow_remove = Helpers.toBool(Helpers.ifNull(opts.allow_remove, true));
        Helpers.each([
            ['upload_notes', 's'], ['disable_auto_save', 'b'],
            ['allow_multiple', 'b'], ['disable_file_browser', 'b'],
        ], function(k) {
            tmp.options[k[0]] = this._parse_options_val(opts[k[0]], k[1]);
        }, this);
        Helpers.each([
            ['max_file_size', 'i'], ['allowed_file_types', 'a'],
            ['max_number_of_files', 'i'], ['as_public', 'b'],
        ],
        function(k) {
            tmp.options.restrictions[k[0]] = this._parse_options_val(opts[k[0]], k[1]);
        }, this);
        Helpers.each([['allowed_filename', 'r']], function(k) {
            tmp.options.extra[k[0]] = this._parse_options_val(opts[k[0]], k[1]);
        }, this);
        if (this._is_webform) tmp.options.disable_file_browser = true;
        this._parse_allowed_file_types(tmp.options);
        return tmp;
    },
    _parse_options_val: function(v, t) {
        if (Helpers.isEmpty(v)) v = null;
        if (t === 's') return v && (v = cstr(v)) && v.length ? v : null;
        if (t === 'b') return Helpers.toBool(Helpers.ifNull(v, false));
        if (t === 'i') return v && (v = cint(v)) && !isNaN(v) && v > 0 ? v : null;
        if (t === 'a') return Helpers.toArray(v);
        if (t === 'r')
            return v && (Helpers.isRegExp(v) || ((v = cstr(v)) && v.length))
                ? (v[0] === '/' ? new RegExp(v) : v) : null;
        return v;
    },
    _parse_allowed_file_types: function(opts) {
        opts.extra.allowed_file_types = [];
        if (Helpers.isEmpty(opts.restrictions.allowed_file_types)) return;
        opts.restrictions.allowed_file_types = Helpers.filter(
            opts.restrictions.allowed_file_types,
            function(v) { return this.isRegExp(v) || (this.isString(v) && v.length); }
        );
        Helpers.each(opts.restrictions.allowed_file_types, function(t, i) {
            if (this.isString(t)) {
                if (t[0] === '$') t = new RegExp(t.substring(1));
                else if (t.substring(t.length - 2) === '/*')
                    t = new RegExp(t.substring(0, t.length - 1) + '/(.*?)');
            }
            opts.extra.allowed_file_types.push(t);
        });
        opts.restrictions.allowed_file_types = Helpers.filter(
            opts.restrictions.allowed_file_types,
            function(v) { return this.isString(v) && v[0] !== '$'; }
        );
    },
    _toggle_remove_button: function() {
        var show = this._allow_remove;
        this.$value && this.$value.find('[data-action="clear_attachment"]').toggle(show);
        if (!this._$list) return;
        this._$list_group.find('.ba-actions').each(function(i, el) {
            $(el).toggleClass('ba-hidden', !show);
        });
    },
    _reload_control: function(opts) {
        if (this.upload_options) this.upload_options = null;
        
        this._disable_auto_save = this._options && this._options.disable_auto_save;
        
        if (Helpers.ifNull(opts.allow_remove, true) !== this._allow_remove)
            this.toggle_remove(!this._allow_remove);
        
        var allow_multiple = this._options && this._options.allow_multiple;
        if (allow_multiple === this._allow_multiple) return;
        this._allow_multiple = allow_multiple;
        this._set_max_attachments();
        if (!this._display_ready) return;
        this._setup_display(true);
        if (!this._value.length) return;
        var value = this._value.pop();
        if (!this._allow_multiple && this._value.length) {
            var failed = 0;
            this._remove_files(this._value, function(ret) {
                if (!cint(ret)) failed++;
            });
            if (failed) Helpers.error('Unable to delete the uploaded attachments.');
        }
        this._reset_value();
        this.set_input(value);
    },
    _set_max_attachments: function() {
        if (!this.frm) return;
        var meta = frappe.get_meta(this.frm.doctype);
        if (
            !this._allow_multiple || !Helpers.isPlainObject(this._options)
            || Helpers.isEmpty(this._options.restrictions.max_number_of_files)
        ) {
            if (meta && this._max_attachments.meta != null)
                meta.max_attachments = this._max_attachments.meta;
            if (this.frm.meta && this._max_attachments.fmeta != null)
                this.frm.meta.max_attachments = this._max_attachments.fmeta;
            return;
        }
        var val = this._options.restrictions.max_number_of_files;
        if (meta && val > cint(meta.max_attachments)) {
            if (this._max_attachments.meta == null)
                this._max_attachments.meta = meta.max_attachments;
            meta.max_attachments = val;
        }
        if (this.frm.meta && val > cint(this.frm.meta.max_attachments)) {
            if (this._max_attachments.fmeta == null)
                this._max_attachments.fmeta = this.frm.meta.max_attachments;
            this.frm.meta.max_attachments = val;
        }
    },
    _set_image_upload_options: function() {
        let opts = Helpers.deepClone(this.upload_options),
        extra = [];
        if (Helpers.isEmpty(opts.restrictions.allowed_file_types))
            opts.restrictions.allowed_file_types = ['image/*'];
        else
            opts.restrictions.allowed_file_types = Filetype.to_images_list(
                Helpers.toArray(opts.restrictions.allowed_file_types)
            );
        if (!opts.extra) opts.extra = {};
        else Helpers.each(opts.extra.allowed_file_types, function(v, i) {
            i = Helpers.isRegExp(v) ? '' + v.source : v;
            if (Helpers.isString(i) && Filetype.is_ext_image(i)) extra.push(v);
        });
        opts.extra.allowed_file_types = extra;
        this.upload_options = opts;
    },
    _set_value: function(value) {
        if (this._value.indexOf(value) >= 0) return value;
        this._value.push(value);
        var idx = this._value.length - 1;
        if (this._allow_multiple) {
            this.value = Helpers.toJson(this._value);
            this._add_file(value, idx);
            value = this.value;
        }
        else if (!this._images_only) this._add_file(value, idx);
        return value;
    },
    _setup_display: function(reset) {
        if (this._allow_multiple) {
            if (reset) this._destroy_popover();
            this._setup_list();
        } else {
            if (reset) {
                this._destroy_list();
                this._files.length && Helpers.clear(this._files);
            }
            this._setup_popover();
        }
        this._display_ready = true;
    },
    _setup_popover: function() {
        if (this._popover_ready) return;
        this.$value.find('.attached-file-link').first()
        .popover({
            trigger: 'hover',
            placement: 'top',
            content: Helpers.fnBind(function() {
                var file = !this._images_only ? this._files[this._files.length - 1] : null,
                url = file ? file.file_url : this.value;
                if ((file && file.class === 'image') || this._images_only) {
                    return '<div>'
                        + '<img src="' + url +'" style="width:150px!important;height:auto;object-fit:contain"/>'
                    + '</div>';
                }
                if (file) {
                    if (file.class === 'video') {
                        return '<video style="width:150px!important;height:100px!important;" controls>'
                            + '<source src="' + url + '" type="' + file.type + '"/>'
                            + __("Your browser does not support the video element.")
                        + '</video>';
                    }
                    if (file.class === 'audio') {
                        return '<audio style="width:150px!important;height:60px!important;" controls>'
                            + '<source src="' + url + '" type="' + file.type + '"/>'
                            + __("Your browser does not support the audio element.")
                        + '</audio>';
                    }
                }
                return '<div>'
                    + __("This file type has no preview.")
                + '</div>';
            }, this),
            html: true
        });
        this._popover_ready = true;
    },
    _destroy_popover: function() {
        if (this._popover_ready)
            try {
                this.$value.find('.attached-file-link').popover('dispose');
            } catch(_) {}
        this._popover_ready = null;
    },
    _add_file: function(value, idx) {
        var val = {
            name: null,
            file_name: Filetype.get_filename(value),
            file_url: value,
            extension: null,
            type: null,
            size: 0,
            size_str: '',
            'class': 'other',
        };
        this._files[idx] = val;
        if (
            this.file_uploader && this.file_uploader.uploader
            && this.file_uploader.uploader.files
        ) {
            Helpers.each(this.file_uploader.uploader.files, function(f) {
                if (!f.doc || f.doc.file_url !== val.file_url) return;
                val.name = f.doc.name;
                if (f.file_obj) {
                    if (!this.isEmpty(f.file_obj.file_name)) {
                        val.file_name = f.file_obj.file_name;
                        val.extension = Filetype.get_file_ext(val.file_name);
                        if (this.isEmpty(f.file_obj.type))
                            val.type = Filetype.get_file_type(val.extension);
                        val = Filetype.set_file_info(val);
                    }
                    if (!this.isEmpty(f.file_obj.type))
                        val.type = f.file_obj.type.toLowerCase().split(';')[0];
                    if (!this.isEmpty(f.file_obj.size)) {
                        val.size = f.file_obj.size;
                        val.size_str = this.formatSize(val.size);
                    }
                }
                return false;
            });
        }
        if (Helpers.isEmpty(val.extension)) {
            val.extension = Filetype.get_file_ext(val.file_name);
            val = Filetype.set_file_info(val);
        }
        if (Helpers.isEmpty(val.type))
            val.type = Filetype.get_file_type(val.extension);
        if (Helpers.isEmpty(val.name) && this.frm) {
            if (!this._multiple_values) this._process_files(idx);
            else this._unprocessed_files.push(idx);
        } else {
            if (Helpers.isEmpty(val.name)) val.name = val.file_name;
            this._add_list_file(val, idx);
        }
    },
    _process_files: function(idx) {
        if (idx == null && !this._unprocessed_files.length) return;
        if (idx != null) {
            try {
                frappe.db.get_value(
                    'File', {file_url: this._files[idx].file_url}, 'name',
                    Helpers.fnBind(function(ret) {
                        if (Helpers.isPlainObject(ret) && ret.name) {
                            this._files[idx].name = ret.name;
                            if (this.frm && this.frm.attachments)
                                this.frm.attachments.update_attachment(this._files[idx]);
                        }
                        this._add_list_file(this._files[idx], idx);
                    }, this)
                );
            } catch(_) {
                Helpers.error(
                    'Unable to get the File doctype entry name for the uploaded attachment ({0}).',
                    [this._files[idx].name]
                );
            }
            return;
        }
        var names = [],
        urls = [];
        Helpers.each(this._unprocessed_files, function(idx) {
            names.push(this._files[idx].name);
            urls.push(this._files[idx].file_url);
        }, this);
        frappe.db.get_list('File', {
            fields: ['name', 'file_url'],
            filters: {file_url: ['in', urls]},
            limit: urls.length
        }).then(Helpers.fnBind(function(ret) {
            var data = {};
            Helpers.each(Helpers.toArray(ret), function(v) {
                if (this.isPlainObject(v) && v.file_url) data[v.file_url] = v.name;
            });
            Helpers.each(this._unprocessed_files, function(idx, i) {
                i = data[this._files[idx].file_url];
                if (i) {
                    this._files[idx].name = i;
                    if (this.frm && this.frm.attachments)
                        this.frm.attachments.update_attachment(this._files[idx]);
                }
                this._add_list_file(this._files[idx], idx);
            }, this);
            Helpers.clear(this._unprocessed_files);
        }, this))
        .catch(function() {
            Helpers.error(
                'Unable to get the File doctype entry name for the uploaded attachments ({0}).',
                [names.join(', ')]
            );
        });
    },
    _add_list_file: function(file, idx) {
        // Check if allowed multiple files or not
        if (!this._allow_multiple || !this._$list) return;
        var meta = '',
        rem = !this._allow_remove ? ' ba-hidden' : '';
        if (file.size && file.size_str)
            meta = '<div class="ba-meta">' + file.size_str + '</div>';
        this._$list_group.append(
            '<li class="list-group-item ba-attachment" data-file-idx="' + idx + '">'
                + '<div class="row align-items-center">'
                    + '<div class="col ba-hidden-overflow">'
                        + '<div class="flex align-center">'
                            + '<div class="ba-file ba-' + file.class + '"></div>'
                            + '<a href="' + file.file_url + '" class="ba-link" target="__blank">'
                                + file.file_name
                            + '</a>'
                            + meta
                        + '</div>'
                    + '</div>'
                    + '<div class="col-auto ba-actions">'
                        + '<button type="button" class="ba-remove btn btn-danger btn-xs mx-0' + rem + '">'
                            + '<span class="fa fa-times fa-fw"></span>'
                        + '</button>'
                    + '</div>'
                + '</div>'
            + '</li>'
        );
    },
    _remove_files: function(data, callback, error) {
        if (!Helpers.isArray(data)) data = [data];
        Helpers.request(
            'remove_files', {files: data},
            Helpers.fnBind(callback, this),
            Helpers.fnBind(error, this)
        );
    },
    _remove_file_by_idx: function(idx) {
        var len = this._value.length;
        if (!this._allow_multiple || (len - 1) < idx) return;
        var url = this._value[idx];
        this._value.splice(idx, 1);
        if (this._allow_multiple) this._files.splice(idx, 1);
        len--;
        this.value = len ? Helpers.toJson(this._value) : null;
        if (this._allow_multiple && this._$list) {
            var child = this._$list_group.find('li[data-file-idx="' + idx + '"]');
            if (child.length) child.remove();
        }
        this._remove_file_by_url(url);
    },
    _remove_file_by_url: function(url) {
        if (!this.frm || !this.frm.attachments)
            this._remove_files(url, function(ret) {
                if (!cint(ret)) Helpers.error('Unable to remove the uploaded attachment ({0}).', [url]);
            });
        else this.frm.attachments.remove_attachment_by_filename(
            url, Helpers.fnBind(function() {
                this.parse_validate_and_set_in_model(this.value);
                this.refresh();
                this._form_save();
            }, this)
        );
    },
    _setup_list: function() {
        if (this._$list) return;
        $(this.$value.children()[0]).children().each(function(i, el) {
            $(el).addClass('ba-hidden');
        });
        this._$list = $(
            '<div class="attached-file row align-center mt-4 ba-hidden">'
                + '<div class="col-12">'
                    + '<ul class="list-group">'
                    + '</ul>'
                + '</div>'
            + '</div>'
        ).appendTo(this.input_area);
        this._$list_group = this._$list.find('ul.list-group');
        var me = this;
        this._$list_group.click('.ba-remove', function() {
            var $el = $(this);
            if (!$el.hasClass('ba-remove')) return;
            var $parent = $el.parents('.ba-attachment');
            if (!$parent.length) return;
            var idx = $parent.attr('data-file-idx');
            if (!idx || !/[0-9]+/.test('' + idx)) return;
            idx = cint(idx);
            if (idx >= 0) me._remove_file_by_idx(idx);
        });
    },
    _destroy_list: function() {
        if (this._$list) {
            this._$list.remove();
            $(this.$value.children()[0]).children().each(function(i, el) {
                $(el).removeClass('ba-hidden');
            });
        }
        this._$list = this._$list_group = null;
    },
    _update_input: function(value, dataurl) {
        value = value || this._value[this._value.length - 1];
        this.$input.toggle(false);
        var file_url_parts = value.match(/^([^:]+),(.+):(.+)$/),
        filename = null;
        if (file_url_parts) {
            filename = file_url_parts[1];
            dataurl = file_url_parts[2] + ':' + file_url_parts[3];
        }
        if (!filename) filename = dataurl ? value : value.split('/').pop();
        var $link = this.$value.toggle(true).find('.attached-file-link');
        if (!this._allow_multiple) $link.html(filename).attr('href', dataurl || value);
        else {
            $link.html(this._value.length > 1
                ? this._value.length + ' ' + __('files uploaded')
                : filename
            ).attr('href', '#');
            if (this._$list && this._$list.hasClass('ba-hidden'))
                this._$list.removeClass('ba-hidden');
        }
    },
    _reset_input: function() {
        this.dataurl = null;
        this.fileobj = null;
        this.set_input(null);
        this.parse_validate_and_set_in_model(null);
        this.refresh();
    },
    _reset_value: function() {
        this.value = null;
        this.$input.toggle(true);
        this.$value.toggle(false);
        Helpers.clear(this._value);
        if (!this._allow_multiple) return;
        Helpers.clear(this._files);
        if (this._$list)
            this._$list_group.children().each(function(i, el) {
                $(el).remove();
            });
    },
    _form_save: function() {
        if (this._disable_auto_save) return;
        this.frm.doc.docstatus == 1 ? this.frm.save('Update') : this.frm.save();
    }
});